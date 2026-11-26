(() => {
  "use strict";

  const HEBREW_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

  const EXTRA_FILTER_LABELS = {
    starred: "⭐ מועדפים",
    unsure: "🤔 התלבטתי",
    problematic: "⚠️ בעייתיות",
    with_image: "🖼️ עם תמונה",
    with_note: "📝 עם הערה שלי",
    with_any_note: "💬 עם הערות באתר",
    appeal: "⚖️ שאלות ערעור",
    drill: "🔄 לתיקון טעויות",
    highlighted: "🖍️ עם מרקור שלי",
  };

  const ATTEMPT_LABELS = {
    wrong: "❌ טעיתי בהן",
    correct: "✅ לא טעיתי (צדקתי)",
    unsolved: "⏳ לא נפתרו",
  };

  const GROUP_BY_LABELS = {
    none: "ללא הפרדה (רצף אחד)",
    subject: "לפי נושאים",
    year: "לפי שנים במבחנים",
    subject_year: "נושא ← שנה",
    year_subject: "שנה ← נושא",
    correctness: "לפי טעיתי / לא טעיתי / לא נפתרו",
  };

  function toSet(val) {
    if (val instanceof Set) return val;
    if (Array.isArray(val)) return new Set(val.filter(Boolean));
    return new Set();
  }

  function getEffectiveSubject(q, mergePathology) {
    return mergePathology ? (q.baseSubject || q.subject) : q.subject;
  }

  function getAttemptStatus(att) {
    if (!att) return "unsolved";
    return att.isCorrect ? "correct" : "wrong";
  }

  function sanitizeFilename(name, fallback = "export") {
    const cleaned = String(name || "")
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "");
    return cleaned || fallback;
  }

  function formatTimestampHe(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "";
    try {
      return new Date(n).toLocaleString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function getNotesForQuestion(qId, notesScope, ctx) {
    if (notesScope === "none") return [];

    const myNoteText = (ctx.getMyNoteText?.(qId) || "").trim();
    const myIdentity = ctx.userIdentity || { userId: "me", name: "אני", emoji: "📝" };

    if (notesScope === "mine") {
      if (!myNoteText) return [];
      const myUpdatedAt = Number(ctx.progress?.noteUpdatedAt?.[qId]) || 0;
      return [
        {
          userId: myIdentity.userId,
          author: myIdentity.name,
          emoji: myIdentity.emoji || "📝",
          text: myNoteText,
          updatedAt: myUpdatedAt,
          isMine: true,
          replies: [],
        },
      ];
    }

    // notesScope === "all"
    const commList = (ctx.getQuestionCommunityNotesList?.(qId) || []).map((n) => ({
      ...n,
      replies: (ctx.getNoteRepliesTree?.(qId, n.userId) || []).map((r) => ({ ...r })),
    }));

    if (myNoteText && !commList.some((n) => n.isMine)) {
      commList.unshift({
        userId: myIdentity.userId,
        author: myIdentity.name,
        emoji: myIdentity.emoji || "📝",
        text: myNoteText,
        updatedAt: Number(ctx.progress?.noteUpdatedAt?.[qId]) || 0,
        isMine: true,
        replies: [],
      });
    }
    return commList;
  }

  function matchesExtraFilter(key, q, itemCtx) {
    const { att, fl, streak, myNote, qCommNotes, qProblems, highlights } = itemCtx;
    switch (key) {
      case "starred":
        return Boolean(fl.star);
      case "unsure":
        return Boolean(fl.unsure);
      case "problematic":
        return qProblems.length > 0 || (!itemCtx.cloudCommunityLoaded && Boolean(fl.problem));
      case "with_image":
        return Array.isArray(q.images) && q.images.length > 0;
      case "with_note":
        return myNote.length > 0;
      case "with_any_note":
        return qCommNotes.length > 0 || myNote.length > 0;
      case "appeal":
        return Boolean(
          q.allAccepted ||
            (Array.isArray(q.correct) && q.correct.length > 1) ||
            (typeof q.appealNote === "string" && q.appealNote.trim().length > 0)
        );
      case "drill": {
        const needsDrill = (att && (!att.isCorrect || streak === 1)) || Boolean(fl.unsure);
        return Boolean(needsDrill && streak < 2);
      }
      case "highlighted":
        return Array.isArray(highlights) && highlights.length > 0;
      default:
        return false;
    }
  }

  function filterQuestions(questions, rawConfig, ctx) {
    const config = rawConfig || {};
    const attemptsSet = toSet(config.attempts);
    const examsSet = toSet(config.exams);
    const subjectsSet = toSet(config.subjects);
    const extraSet = toSet(config.extraFilters);
    const extraMatchMode = config.extraMatchMode === "and" ? "and" : "or";
    const mergePathology = config.mergePathology !== undefined ? Boolean(config.mergePathology) : true;
    const notesScope = config.notesScope || "all";
    const detailLevel = config.detailLevel || "full";
    const onlyWithNotes = Boolean(config.onlyWithNotes) || detailLevel === "notes_only";
    const searchTerm = typeof config.search === "string" ? config.search.trim().toLowerCase() : "";

    const progress = ctx.progress || {};
    const attemptsMap = progress.attempts || {};
    const flagsMap = progress.flags || {};
    const drillStreakMap = progress.drillStreak || {};
    const highlightsMap = progress.highlights || {};

    const results = [];

    for (const q of questions) {
      if (examsSet.size > 0 && !examsSet.has(q.exam)) continue;

      const effSubj = getEffectiveSubject(q, mergePathology);
      if (subjectsSet.size > 0 && !subjectsSet.has(effSubj)) continue;

      const att = attemptsMap[q.id] || null;
      const attemptStatus = getAttemptStatus(att);
      if (attemptsSet.size > 0 && !attemptsSet.has(attemptStatus)) continue;

      const fl = flagsMap[q.id] || {};
      const streak = Number(drillStreakMap[q.id]) || 0;
      const myNote = (ctx.getMyNoteText?.(q.id) || "").trim();
      const qCommNotes = ctx.getQuestionCommunityNotesList?.(q.id) || [];
      const qProblems = ctx.getQuestionProblemsList?.(q.id) || [];
      const highlights = highlightsMap[q.id] || [];

      if (extraSet.size > 0) {
        const itemCtx = {
          att,
          fl,
          streak,
          myNote,
          qCommNotes,
          qProblems,
          highlights,
          cloudCommunityLoaded: Boolean(ctx.cloudCommunityLoaded),
        };
        if (extraMatchMode === "and") {
          let allMatch = true;
          for (const key of extraSet) {
            if (!matchesExtraFilter(key, q, itemCtx)) {
              allMatch = false;
              break;
            }
          }
          if (!allMatch) continue;
        } else {
          let anyMatch = false;
          for (const key of extraSet) {
            if (matchesExtraFilter(key, q, itemCtx)) {
              anyMatch = true;
              break;
            }
          }
          if (!anyMatch) continue;
        }
      }

      const exportedNotes = getNotesForQuestion(q.id, notesScope, ctx);
      if (onlyWithNotes && notesScope !== "none" && exportedNotes.length === 0) {
        continue;
      }

      if (searchTerm) {
        const commText = qCommNotes
          .map((n) => {
            const reps = (ctx.getNoteRepliesTree?.(q.id, n.userId) || [])
              .map((r) => `${r.emoji || ""} ${r.author || ""} ${r.text || ""}`)
              .join(" ");
            return `${n.emoji || ""} ${n.author || ""} ${n.text || ""} ${reps}`;
          })
          .join(" ");
        const probText = qProblems.map((p) => `${p.author || ""} ${p.text || ""}`).join(" ");
        const hay = [
          q.stem || "",
          (q.options || []).map((o) => o.text || "").join(" "),
          myNote,
          commText,
          probText,
          q.exam || "",
          q.subject || "",
          q.baseSubject || "",
          q.topic || "",
          q.explanation || "",
          q.appealNote || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(searchTerm)) continue;
      }

      results.push({
        q,
        effSubj,
        att,
        attemptStatus,
        fl,
        streak,
        qProblems,
        exportedNotes,
      });
    }

    return results;
  }

  function sortItemsChronological(items) {
    return items.slice().sort((a, b) => {
      const ea = Number.isFinite(a.q.examIndex) ? a.q.examIndex : 9999;
      const eb = Number.isFinite(b.q.examIndex) ? b.q.examIndex : 9999;
      if (ea !== eb) return ea - eb;
      return (Number(a.q.num) || 0) - (Number(b.q.num) || 0);
    });
  }

  function groupItems(items, groupBy) {
    const ordered = sortItemsChronological(items);
    if (!groupBy || groupBy === "none") {
      return [
        {
          key: "all",
          title: "כל השאלות",
          filename: "שאלות_מקבץ_1",
          items: ordered,
          subgroups: null,
        },
      ];
    }

    if (groupBy === "correctness") {
      const order = ["wrong", "correct", "unsolved"];
      const map = new Map(order.map((k) => [k, []]));
      for (const item of ordered) {
        map.get(item.attemptStatus).push(item);
      }
      return order
        .filter((k) => map.get(k).length > 0)
        .map((k) => ({
          key: k,
          title: ATTEMPT_LABELS[k],
          filename: sanitizeFilename(
            k === "wrong" ? "שאלות_שטעיתי_בהן" : k === "correct" ? "שאלות_שצדקתי_בהן" : "שאלות_שלא_נפתרו"
          ),
          items: map.get(k),
          subgroups: null,
        }));
    }

    if (groupBy === "subject") {
      const map = new Map();
      for (const item of ordered) {
        const key = item.effSubj || "כללי";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "he"))
        .map(([subj, list]) => ({
          key: subj,
          title: subj,
          filename: sanitizeFilename(subj),
          items: list,
          subgroups: null,
        }));
    }

    if (groupBy === "year") {
      const map = new Map();
      for (const item of ordered) {
        const key = item.q.exam || "כללי";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      return Array.from(map.entries()).map(([exam, list]) => ({
        key: exam,
        title: exam,
        filename: sanitizeFilename(exam),
        items: list,
        subgroups: null,
      }));
    }

    if (groupBy === "subject_year") {
      const subjGroups = groupItems(ordered, "subject");
      return subjGroups.map((sg) => {
        const sub = groupItems(sg.items, "year");
        return {
          ...sg,
          subgroups: sub,
        };
      });
    }

    if (groupBy === "year_subject") {
      const yearGroups = groupItems(ordered, "year");
      return yearGroups.map((yg) => {
        const sub = groupItems(yg.items, "subject");
        return {
          ...yg,
          subgroups: sub,
        };
      });
    }

    return groupItems(ordered, "none");
  }

  function formatOptionLabel(q, idx) {
    const opt = q.options?.[idx];
    if (!opt) return "";
    const letter = opt.letter || HEBREW_LETTERS[idx] || String(idx + 1);
    return `${letter}. ${opt.text}`;
  }

  function buildFlagsLabels(item, ctx) {
    const { q, att, attemptStatus, fl, qProblems } = item;
    const tags = [];
    if (attemptStatus === "wrong") tags.push("❌ טעיתי");
    else if (attemptStatus === "correct") tags.push("✅ צדקתי");
    else tags.push("⏳ לא נפתרה");

    if (fl.star) tags.push("⭐ מועדף");
    if (fl.unsure) tags.push("🤔 התלבטתי");
    if (qProblems.length > 0 || (!ctx.cloudCommunityLoaded && fl.problem)) tags.push("⚠️ בעייתית");
    if (q.allAccepted || (Array.isArray(q.correct) && q.correct.length > 1)) tags.push("⚖️ ערעור");
    if (q.topic) tags.push(`📌 ${q.topic}`);
    return tags;
  }

  function renderNoteCalloutsMarkdown(item, config, ctx) {
    const lines = [];
    const problemLabels = ctx.problemTypes || {};

    if (config.includeProblems !== false && item.qProblems.length > 0) {
      for (const p of item.qProblems) {
        const info = problemLabels[p.type] || { label: "בעיה בשאלה", emoji: "⚠️" };
        const author = `${p.emoji || "⚠️"} ${p.author || "אנונימי"}`.trim();
        const body = (p.text || "").trim().replace(/\n/g, "\n> ");
        lines.push(`> [!warning] ${info.emoji} ${info.label} (${author})${body ? `\n> ${body}` : ""}`);
      }
    }

    for (const n of item.exportedNotes) {
      const body = (n.text || "").trim().replace(/\n/g, "\n> ");
      const timeStr = n.updatedAt ? ` · ${formatTimestampHe(n.updatedAt)}` : "";
      if (n.isMine) {
        lines.push(`> [!tip] 📝 ההערה שלי (${n.emoji} ${n.author}${timeStr})\n> ${body}`);
      } else {
        lines.push(`> [!note] ${n.emoji} ${n.author}${timeStr}\n> ${body}`);
      }
      if (Array.isArray(n.replies) && n.replies.length > 0) {
        for (const r of n.replies) {
          const indentPrefix = r.depth > 0 ? "> > " : "> ";
          const rTime = r.createdAt ? ` (${formatTimestampHe(r.createdAt)})` : "";
          const replyTo = r.effectiveReplyToAuthor ? ` ↩️ ל-${r.effectiveReplyToAuthor}` : "";
          const rBody = (r.text || "").trim().replace(/\n/g, `\n${indentPrefix}`);
          lines.push(`${indentPrefix}↳ **${r.emoji || "💬"} ${r.author || "אנונימי"}**${replyTo}${rTime}: ${rBody}`);
        }
      }
    }
    return lines;
  }

  function renderQuestionMarkdown(item, config, ctx, headingLevel = 3) {
    const { q, effSubj, att } = item;
    const detailLevel = config.detailLevel || "full";
    const hashes = "#".repeat(Math.min(6, Math.max(2, headingLevel)));
    const tags = buildFlagsLabels(item, ctx);
    const lines = [];

    lines.push(`${hashes} ${q.exam} · שאלה ${q.num} · ${effSubj} (${tags.join(" | ")})`);

    const corrText = (q.correct || []).map((i) => formatOptionLabel(q, i)).filter(Boolean).join(" / ");
    const myWrongText =
      att && !att.isCorrect && Number.isInteger(att.selected) && q.options?.[att.selected]
        ? formatOptionLabel(q, att.selected)
        : "";

    if (detailLevel === "notes_only") {
      const stemShort = (q.stem || "").replace(/\s+/g, " ").trim();
      if (stemShort) {
        const snippet = stemShort.length > 160 ? stemShort.slice(0, 157) + "..." : stemShort;
        lines.push(`> ${snippet}`);
      }
      if (corrText) {
        lines.push(`- **תשובה נכונה:** ${corrText}`);
      }
      if (myWrongText) {
        lines.push(`- **הבחירה שלי (שגויה):** ${myWrongText}`);
      }
      const noteLines = renderNoteCalloutsMarkdown(item, config, ctx);
      if (noteLines.length > 0) {
        lines.push(...noteLines);
      }
      lines.push("");
      return lines.join("\n");
    }

    if (q.stem) {
      lines.push(q.stem);
      lines.push("");
    }

    if (detailLevel === "full" && Array.isArray(q.options) && q.options.length > 0) {
      q.options.forEach((opt, idx) => {
        const isCorr = Array.isArray(q.correct) && q.correct.includes(idx);
        const isMyWrong = att && !att.isCorrect && att.selected === idx;
        const marker = isCorr ? " ✅" : isMyWrong ? " ❌ *(הבחירה שלי)*" : "";
        const letter = opt.letter || HEBREW_LETTERS[idx] || String(idx + 1);
        lines.push(`- **${letter}.** ${opt.text}${marker}`);
      });
      lines.push("");
    }

    if (corrText) {
      lines.push(`- **תשובה נכונה:** ${corrText}`);
    }
    if (myWrongText) {
      lines.push(`- **הבחירה שלי (שגויה):** ${myWrongText}`);
    }
    if (q.allAccepted) {
      lines.push("- **הערת ערעור:** כל התשובות התקבלו בשאלה זו.");
    } else if (q.appealNote) {
      lines.push(`- **הערת ערעור:** ${q.appealNote}`);
    }
    if (q.explanation) {
      lines.push(`- **הסבר:** ${q.explanation}`);
    }

    const noteLines = renderNoteCalloutsMarkdown(item, config, ctx);
    if (noteLines.length > 0) {
      lines.push(...noteLines);
    }

    lines.push("");
    return lines.join("\n");
  }

  function buildFilterSummaryLines(config, totalCount) {
    const parts = [];
    const attemptsSet = toSet(config.attempts);
    const examsSet = toSet(config.exams);
    const subjectsSet = toSet(config.subjects);
    const extraSet = toSet(config.extraFilters);

    if (attemptsSet.size > 0) {
      parts.push(`סטטוס מענה: ${Array.from(attemptsSet).map((k) => ATTEMPT_LABELS[k] || k).join(", ")}`);
    } else {
      parts.push("סטטוס מענה: הכל");
    }
    if (subjectsSet.size > 0) {
      parts.push(`נושאים: ${Array.from(subjectsSet).join(", ")}`);
    }
    if (examsSet.size > 0) {
      parts.push(`שנים/מבחנים: ${Array.from(examsSet).join(", ")}`);
    }
    if (extraSet.size > 0) {
      const sep = config.extraMatchMode === "and" ? " + " : " / ";
      parts.push(`פילטרים נוספים: ${Array.from(extraSet).map((k) => EXTRA_FILTER_LABELS[k] || k).join(sep)}`);
    }
    if (config.search && config.search.trim()) {
      parts.push(`חיפוש: "${config.search.trim()}"`);
    }
    const notesLabel =
      config.notesScope === "mine"
        ? "הערות שלי בלבד"
        : config.notesScope === "none"
        ? "ללא הערות"
        : "כל ההערות באתר";
    parts.push(`הערות: ${notesLabel}`);
    parts.push(`סה"כ שאלות: ${totalCount}`);
    return parts;
  }

  function buildMarkdownDocument(items, config, ctx, { title = "📓 ייצוא שאלות והערות – מקבץ 1", includeToc = true } = {}) {
    const groupBy = config.groupBy || "none";
    const groups = groupItems(items, groupBy);
    const nowStr = new Date().toLocaleString("he-IL");
    const summaryLines = buildFilterSummaryLines(config, items.length);

    const lines = [
      "---",
      "type: mikbatz1-export",
      "cluster: 1",
      `exported_at: "${new Date().toISOString()}"`,
      `count: ${items.length}`,
      `group_by: "${groupBy}"`,
      `notes_scope: "${config.notesScope || "all"}"`,
      "---",
      "",
      `# ${title}`,
      "",
      `> תאריך ייצוא: ${nowStr}  `,
      ...summaryLines.map((s) => `> • ${s}  `),
      "",
    ];

    if (groupBy === "none") {
      for (const item of groups[0]?.items || []) {
        lines.push(renderQuestionMarkdown(item, config, ctx, 2));
      }
      return lines.join("\n");
    }

    if (includeToc && groups.length > 1) {
      lines.push("## 📑 תוכן עניינים");
      for (const g of groups) {
        lines.push(`- **${g.title}** (${g.items.length} שאלות)`);
        if (g.subgroups && g.subgroups.length > 0) {
          for (const sg of g.subgroups) {
            lines.push(`  - ${sg.title} (${sg.items.length})`);
          }
        }
      }
      lines.push("");
    }

    for (const g of groups) {
      lines.push(`## ${g.title} (${g.items.length})`);
      lines.push("");
      if (g.subgroups && g.subgroups.length > 0) {
        for (const sg of g.subgroups) {
          lines.push(`### ${sg.title} (${sg.items.length})`);
          lines.push("");
          for (const item of sg.items) {
            lines.push(renderQuestionMarkdown(item, config, ctx, 4));
          }
        }
      } else {
        for (const item of g.items) {
          lines.push(renderQuestionMarkdown(item, config, ctx, 3));
        }
      }
    }

    return lines.join("\n");
  }

  function buildSeparatedMarkdownFiles(items, config, ctx) {
    const groupBy = config.groupBy && config.groupBy !== "none" ? config.groupBy : "subject";
    const groups = groupItems(items, groupBy);
    const files = [];
    const indexLines = [
      "# 📑 אינדקס ייצוא – מקבץ 1",
      "",
      ...buildFilterSummaryLines(config, items.length).map((s) => `- ${s}`),
      "",
      "## קבצים שנוצרו",
      "",
    ];

    for (const g of groups) {
      if (g.subgroups && g.subgroups.length > 0) {
        indexLines.push(`- **${g.title}** (${g.items.length} שאלות)`);
        for (const sg of g.subgroups) {
          const relPath = `${g.filename}/${sg.filename}.md`;
          const md = buildMarkdownDocument(
            sg.items,
            { ...config, groupBy: "none" },
            ctx,
            { title: `${g.title} · ${sg.title}`, includeToc: false }
          );
          files.push({ path: relPath, content: md, count: sg.items.length });
          indexLines.push(`  - \`${relPath}\` (${sg.items.length} שאלות)`);
        }
      } else {
        const relPath = `${g.filename}.md`;
        const md = buildMarkdownDocument(
          g.items,
          { ...config, groupBy: "none" },
          ctx,
          { title: `${g.title} – מקבץ 1`, includeToc: false }
        );
        files.push({ path: relPath, content: md, count: g.items.length });
        indexLines.push(`- \`${relPath}\` (${g.items.length} שאלות)`);
      }
    }

    files.unshift({
      path: "_אינדקס.md",
      content: indexLines.join("\n") + "\n",
      count: items.length,
    });

    return files;
  }

  function buildCsvOutput(items, config, ctx) {
    const ordered = sortItemsChronological(items);
    const notesScope = config.notesScope || "all";
    const detailLevel = config.detailLevel || "full";

    const headers = [
      "מזהה",
      "שנה / מבחן",
      "מספר שאלה",
      "נושא",
      "תת-נושא",
      "סטטוס מענה",
      "הבחירה שלי",
      "תשובה נכונה",
      "סימונים",
    ];
    if (detailLevel !== "notes_only") {
      headers.push("נוסח השאלה");
    } else {
      headers.push("תקציר השאלה");
    }
    if (detailLevel === "full") {
      headers.push("מסיחים");
    }
    headers.push("הסבר / ערעור");
    if (notesScope !== "none") {
      headers.push("ההערה שלי");
    }
    if (notesScope === "all") {
      headers.push("הערות קהילה ותגובות");
    }

    const csvCell = (val) => {
      const str = String(val ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = [headers.map(csvCell).join(",")];

    for (const item of ordered) {
      const { q, effSubj, att, attemptStatus } = item;
      const statusText =
        attemptStatus === "wrong" ? "טעיתי" : attemptStatus === "correct" ? "צדקתי" : "לא נפתרה";
      const myChoice =
        att && Number.isInteger(att.selected) && q.options?.[att.selected]
          ? formatOptionLabel(q, att.selected)
          : "";
      const corrText = (q.correct || []).map((i) => formatOptionLabel(q, i)).filter(Boolean).join(" | ");
      const flagsText = buildFlagsLabels(item, ctx)
        .filter((t) => !t.startsWith("❌") && !t.startsWith("✅") && !t.startsWith("⏳") && !t.startsWith("📌"))
        .join(" | ");
      const stemVal =
        detailLevel === "notes_only"
          ? ((q.stem || "").replace(/\s+/g, " ").trim().slice(0, 140))
          : (q.stem || "");
      const optsVal = (q.options || []).map((_, idx) => formatOptionLabel(q, idx)).join("\n");
      const appealParts = [];
      if (q.allAccepted) appealParts.push("כל התשובות התקבלו");
      else if (q.appealNote) appealParts.push(q.appealNote);
      if (q.explanation) appealParts.push(q.explanation);

      const myNotes = item.exportedNotes.filter((n) => n.isMine).map((n) => n.text.trim()).join("\n---\n");
      const commNotes = item.exportedNotes
        .filter((n) => !n.isMine)
        .map((n) => {
          const reps = (n.replies || [])
            .map((r) => `  ↳ ${r.emoji || "💬"} ${r.author || "אנונימי"}: ${r.text}`)
            .join("\n");
          return `${n.emoji || "💬"} ${n.author || "אנונימי"}: ${n.text}${reps ? `\n${reps}` : ""}`;
        })
        .join("\n---\n");

      const row = [
        q.id,
        q.exam,
        q.num,
        effSubj,
        q.topic || "",
        statusText,
        myChoice,
        corrText,
        flagsText,
        stemVal,
      ];
      if (detailLevel === "full") {
        row.push(optsVal);
      }
      row.push(appealParts.join(" | "));
      if (notesScope !== "none") {
        row.push(myNotes);
      }
      if (notesScope === "all") {
        row.push(commNotes);
      }
      rows.push(row.map(csvCell).join(","));
    }

    return "\uFEFF" + rows.join("\r\n");
  }

  function serializeExportItemJson(item, config, ctx) {
    const { q, effSubj, att, attemptStatus, fl, qProblems, exportedNotes } = item;
    const detailLevel = config.detailLevel || "full";
    const obj = {
      id: q.id,
      exam: q.exam,
      num: q.num,
      subject: effSubj,
      rawSubject: q.subject,
      topic: q.topic || "",
      attemptStatus,
      mySelectedIndex: att ? att.selected : null,
      mySelectedText:
        att && Number.isInteger(att.selected) && q.options?.[att.selected]
          ? formatOptionLabel(q, att.selected)
          : null,
      correctIndices: q.correct || [],
      correctText: (q.correct || []).map((i) => formatOptionLabel(q, i)),
      flags: {
        star: Boolean(fl.star),
        unsure: Boolean(fl.unsure),
        problem: qProblems.length > 0 || (!ctx.cloudCommunityLoaded && Boolean(fl.problem)),
      },
      stem: q.stem || "",
    };
    if (detailLevel === "full") {
      obj.options = q.options || [];
      obj.images = q.images || [];
      obj.allAccepted = Boolean(q.allAccepted);
      obj.appealNote = q.appealNote || "";
      obj.explanation = q.explanation || "";
    } else if (detailLevel === "compact") {
      obj.allAccepted = Boolean(q.allAccepted);
      obj.appealNote = q.appealNote || "";
      obj.explanation = q.explanation || "";
    }
    if ((config.notesScope || "all") !== "none") {
      obj.notes = exportedNotes.map((n) => ({
        author: `${n.emoji || "💬"} ${n.author || "אנונימי"}`.trim(),
        isMine: Boolean(n.isMine),
        text: n.text,
        updatedAt: n.updatedAt || 0,
        replies: (n.replies || []).map((r) => ({
          author: `${r.emoji || "💬"} ${r.author || "אנונימי"}`.trim(),
          replyTo: r.effectiveReplyToAuthor || "",
          text: r.text,
          createdAt: r.createdAt || 0,
        })),
      }));
    }
    return obj;
  }

  function buildJsonOutput(items, config, ctx) {
    const groupBy = config.groupBy || "none";
    const groups = groupItems(items, groupBy);
    const payload = {
      exportedAt: new Date().toISOString(),
      totalQuestions: items.length,
      config: {
        attempts: Array.from(toSet(config.attempts)),
        exams: Array.from(toSet(config.exams)),
        subjects: Array.from(toSet(config.subjects)),
        extraFilters: Array.from(toSet(config.extraFilters)),
        extraMatchMode: config.extraMatchMode === "and" ? "and" : "or",
        search: config.search || "",
        mergePathology: config.mergePathology !== false,
        notesScope: config.notesScope || "all",
        detailLevel: config.detailLevel || "full",
        groupBy,
      },
      groups: groups.map((g) => {
        if (g.subgroups && g.subgroups.length > 0) {
          return {
            key: g.key,
            title: g.title,
            count: g.items.length,
            subgroups: g.subgroups.map((sg) => ({
              key: sg.key,
              title: sg.title,
              count: sg.items.length,
              questions: sg.items.map((it) => serializeExportItemJson(it, config, ctx)),
            })),
          };
        }
        return {
          key: g.key,
          title: g.title,
          count: g.items.length,
          questions: g.items.map((it) => serializeExportItemJson(it, config, ctx)),
        };
      }),
    };
    return JSON.stringify(payload, null, 2);
  }

  // CRC32 table for pure-JS ZIP archive builder (STORE, UTF-8 filenames)
  const CRC_TABLE = (() => {
    const tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      tbl[i] = c >>> 0;
    }
    return tbl;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function getDosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const dosTime =
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getSeconds() >> 1) & 0x1f);
    const dosDate =
      (((year - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f);
    return { dosTime, dosDate };
  }

  function buildZipArchive(files) {
    const encoder = new TextEncoder();
    const { dosTime, dosDate } = getDosDateTime();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(String(file.path || "file.md"));
      const dataBytes =
        file.content instanceof Uint8Array
          ? file.content
          : encoder.encode(String(file.content || ""));
      const crc = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true); // version needed
      lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
      lv.setUint16(8, 0, true); // STORE
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); // version made by
      cv.setUint16(6, 20, true); // version needed
      cv.setUint16(8, 0x0800, true); // UTF-8 filename flag
      cv.setUint16(10, 0, true); // STORE
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const totalSize = offset + centralSize + eocd.length;
    const out = new Uint8Array(totalSize);
    let pos = 0;
    for (const part of localParts) {
      out.set(part, pos);
      pos += part.length;
    }
    for (const part of centralParts) {
      out.set(part, pos);
      pos += part.length;
    }
    out.set(eocd, pos);
    return out;
  }

  const api = {
    ATTEMPT_LABELS,
    EXTRA_FILTER_LABELS,
    GROUP_BY_LABELS,
    getEffectiveSubject,
    getAttemptStatus,
    getNotesForQuestion,
    filterQuestions,
    groupItems,
    buildMarkdownDocument,
    buildSeparatedMarkdownFiles,
    buildCsvOutput,
    buildJsonOutput,
    buildZipArchive,
    sanitizeFilename,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.MikbatzExport = api;
  }
})();
