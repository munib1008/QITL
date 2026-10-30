/* @ds-bundle: {"format":4,"namespace":"ZIQ","components":[{"name":"Button"},{"name":"EvidenceLabel"},{"name":"CitationChip"},{"name":"HadithGrade"},{"name":"VerseCard"},{"name":"HadithCard"},{"name":"EventCard"},{"name":"ProphetCard"},{"name":"MapLegend"},{"name":"GenealogyLink"},{"name":"EditorialStatus"},{"name":"Comment"},{"name":"TextField"},{"name":"SearchField"},{"name":"Skeleton"},{"name":"Toast"},{"name":"EvidenceDrawer"},{"name":"VerticalTimeline"},{"name":"ProphetJourneyCard"},{"name":"JourneyTimeline"}]} */
(function () {
  var React = window.React, h = React.createElement, useState = React.useState;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(" "); }
  function svg(props, kids) { return h("svg", Object.assign({ viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" }, props), kids); }

  /* Eight-point star (khatam) built from two squares: the ZIQ geometric primitive. */
  function Star(p) { return svg(p, [h("rect", { key: 1, x: 3, y: 3, width: 10, height: 10, fill: "currentColor" }), h("rect", { key: 2, x: 3, y: 3, width: 10, height: 10, fill: "currentColor", transform: "rotate(45 8 8)" })]); }
  var MARKS = {
    quran: function (p) { return Star(p); },
    hadith: function (p) { return svg(p, h("circle", { cx: 8, cy: 8, r: 5.5, fill: "currentColor" })); },
    scholar: function (p) { return svg(p, [h("circle", { key: 1, cx: 8, cy: 8, r: 5.5, fill: "none", stroke: "currentColor", strokeWidth: 1.6 }), h("path", { key: 2, d: "M8 2.5a5.5 5.5 0 0 1 0 11z", fill: "currentColor" })]); },
    estimate: function (p) { return svg(p, h("path", { d: "M2 6c2-2 4 2 6 0s4 2 6 0M2 11c2-2 4 2 6 0s4 2 6 0", fill: "none", stroke: "currentColor", strokeWidth: 1.6 })); },
    disputed: function (p) { return svg(p, [h("path", { key: 1, d: "M8 1.5 14.5 8 8 14.5z", fill: "currentColor" }), h("path", { key: 2, d: "M7 2.9 1.5 8 7 13.1z", fill: "none", stroke: "currentColor", strokeWidth: 1.4 })]); },
    unknown: function (p) { return svg(p, h("path", { d: "M5.5 5.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4V10M8 12.2v.3", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" })); }
  };
  var EV_TEXT = {
    en: { quran: "Quran", hadith: "Authentic Hadith", scholar: "Scholarly interpretation", estimate: "Historical estimate", disputed: "Disputed", unknown: "Unknown" },
    ar: { quran: "القرآن", hadith: "حديث صحيح", scholar: "تفسير العلماء", estimate: "تقدير تاريخي", disputed: "مختلف فيه", unknown: "غير معلوم" }
  };
  var ICON = {
    bookmark: function () { return svg({}, h("path", { d: "M4 2h8v12l-4-3-4 3z", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" })); },
    bookmarked: function () { return svg({}, h("path", { d: "M4 2h8v12l-4-3-4 3z", fill: "currentColor" })); },
    copy: function () { return svg({}, [h("rect", { key: 1, x: 5, y: 5, width: 9, height: 9, rx: 1, fill: "none", stroke: "currentColor", strokeWidth: 1.5 }), h("path", { key: 2, d: "M11 5V2H2v9h3", fill: "none", stroke: "currentColor", strokeWidth: 1.5 })]); },
    share: function () { return svg({}, h("path", { d: "M8 2v8M4.5 5.5 8 2l3.5 3.5M3 9v5h10V9", fill: "none", stroke: "currentColor", strokeWidth: 1.5 })); },
    source: function () { return svg({}, h("path", { d: "M3 2h7l3 3v9H3zM10 2v3h3M5.5 8h5M5.5 11h5", fill: "none", stroke: "currentColor", strokeWidth: 1.4 })); },
    discuss: function () { return svg({}, h("path", { d: "M2 3h12v8H7l-3 3v-3H2z", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" })); },
    search: function () { return svg({}, [h("circle", { key: 1, cx: 7, cy: 7, r: 4.5, fill: "none", stroke: "currentColor", strokeWidth: 1.6 }), h("path", { key: 2, d: "m10.5 10.5 3.5 3.5", stroke: "currentColor", strokeWidth: 1.6 })]); },
    close: function () { return svg({}, h("path", { d: "m3.5 3.5 9 9m0-9-9 9", stroke: "currentColor", strokeWidth: 1.6 })); },
    check: function () { return svg({}, h("path", { d: "m3 8.5 3 3 7-7", fill: "none", stroke: "currentColor", strokeWidth: 1.8 })); },
    alert: function () { return svg({}, [h("path", { key: 1, d: "M8 1.5 15 14H1z", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round" }), h("path", { key: 2, d: "M8 6v4M8 11.8v.4", stroke: "currentColor", strokeWidth: 1.6 })]); },
    flag: function () { return svg({}, h("path", { d: "M3 14V2m0 1h9l-2 3 2 3H3", fill: "none", stroke: "currentColor", strokeWidth: 1.5 })); }
  };

  function Button(p) {
    var v = p.variant || "secondary";
    return h("button", { type: p.type || "button", className: cx("zq-btn", "zq-btn-" + v, p.size === "sm" && "zq-btn-sm", p.className), disabled: p.disabled || p.loading, "aria-busy": p.loading || undefined, onClick: p.onClick },
      p.loading ? h("span", { className: "zq-spin", "aria-hidden": "true" }) : p.icon ? ICON[p.icon] && ICON[p.icon]() : null, p.children);
  }

  function EvidenceLabel(p) {
    var k = p.kind || "unknown", lang = p.lang || "en";
    var text = p.children || (EV_TEXT[lang] || EV_TEXT.en)[k];
    return h("span", { className: "zq-ev zq-ev-" + k, title: p.title }, MARKS[k]({}), h("span", null, text));
  }

  function CitationChip(p) {
    return h(p.href ? "a" : "button", { className: "zq-chip", href: p.href, type: p.href ? undefined : "button", onClick: p.onClick, "aria-label": p.ariaLabel },
      p.kind ? h("span", { className: "zq-chip-kind" }, p.kind) : null, h("span", { dir: "ltr" }, p.children));
  }

  function HadithGrade(p) {
    return h("span", { className: "zq-grade" }, h(EvidenceLabel, { kind: p.authentic ? "hadith" : p.grade ? "scholar" : "unknown" }, p.grade || "Grade not recorded"),
      p.grader ? h("span", null, "graded by ", h("b", null, p.grader)) : null,
      p.source ? h(CitationChip, null, p.source) : null,
      p.varies ? h("span", { className: "zq-grade-varies" }, "· Graded differently by other scholars") : null);
  }

  function Actions(p) {
    var bm = useState(!!p.bookmarked);
    return h("div", { className: "zq-actions", role: "group", "aria-label": "Actions" },
      h("button", { className: "zq-iconbtn", "aria-pressed": bm[0], onClick: function () { bm[1](!bm[0]); p.onBookmark && p.onBookmark(!bm[0]); } }, bm[0] ? ICON.bookmarked() : ICON.bookmark(), bm[0] ? "Saved" : "Bookmark"),
      h("button", { className: "zq-iconbtn", onClick: p.onCopy }, ICON.copy(), "Copy reference"),
      h("button", { className: "zq-iconbtn", onClick: p.onSource }, ICON.source(), "Source"),
      p.onDiscuss ? h("button", { className: "zq-iconbtn", onClick: p.onDiscuss }, ICON.discuss(), "Discuss") : null);
  }

  function VerseCard(p) {
    return h("article", { className: "zq-card", "aria-label": "Quran " + p.reference },
      h("div", { className: "zq-card-head" }, h("p", { className: "zq-eyebrow" }, p.surahName), h("span", { style: { display: "flex", gap: 8, alignItems: "center" } }, p.demo ? h("span", { className: "zq-demo" }, "DEMO") : null, h(EvidenceLabel, { kind: "quran" }), h(CitationChip, null, p.reference))),
      h("p", { className: "zq-ar-quran", lang: "ar", dir: "rtl" }, p.arabic),
      p.translation ? h("p", { className: "zq-trans" }, p.translation) : null,
      h("p", { className: cx("zq-licence", p.licence === "pending" && "zq-licence-pending") }, p.licence === "pending" ? "Translation unavailable — licence pending" : (p.translator ? "Translation: " + p.translator + (p.edition ? " · " + p.edition : "") : "Arabic only")),
      p.actions === false ? null : h(Actions, { bookmarked: p.bookmarked, onBookmark: p.onBookmark, onDiscuss: p.onDiscuss }));
  }

  function HadithCard(p) {
    return h("article", { className: "zq-card", "aria-label": p.collection + " " + p.number },
      h("div", { className: "zq-card-head" }, h("p", { className: "zq-eyebrow" }, p.collection), h("span", { style: { display: "flex", gap: 8, alignItems: "center" } }, p.demo ? h("span", { className: "zq-demo" }, "DEMO") : null, h(CitationChip, null, p.number))),
      p.numbering ? h("p", { className: "zq-meta" }, "Numbering: " + p.numbering) : null,
      p.arabic ? h("p", { className: "zq-ar-naskh", lang: "ar", dir: "rtl" }, p.arabic) : null,
      p.translation ? h("p", { className: "zq-trans" }, p.translation) : null,
      h("ul", { className: "zq-gradings", "aria-label": "Gradings" }, (p.gradings && p.gradings.length ? p.gradings : [{}]).map(function (g, i) { return h("li", { key: i }, h(HadithGrade, g)); })),
      p.actions === false ? null : h(Actions, { onDiscuss: p.onDiscuss }));
  }

  var PREC = { exact: "Exact date", range: "Date range", estimated: "Estimated", relative: "Relative order only", unknown: "Date unknown" };
  function DateTrack(p) {
    var s = p.start == null ? 30 : p.start, e = p.end == null ? s + 30 : p.end, pr = p.precision;
    var mark = pr === "exact" ? h("span", { className: "zq-track-exact", style: { insetInlineStart: "calc(" + s + "% - 6px)" } })
      : pr === "range" ? h("span", { className: "zq-track-range", style: { insetInlineStart: s + "%", width: (e - s) + "%" } })
      : pr === "estimated" ? h("span", { className: "zq-track-est", style: { insetInlineStart: s + "%", width: (e - s) + "%" } })
      : pr === "relative" ? h("span", { className: "zq-track-rel", style: { insetInlineStart: "calc(" + s + "% - 6px)" } })
      : h("span", { className: "zq-track-unknown" });
    return h("div", { className: "zq-track", role: "img", "aria-label": PREC[pr] }, h("span", { className: "zq-track-line" }), mark);
  }
  function EventCard(p) {
    var pr = p.precision || "unknown";
    return h("article", { className: "zq-card", style: { maxWidth: 420 } },
      h("div", { className: "zq-card-head" }, h("p", { className: "zq-eyebrow" }, p.category || "Event"), p.evidence ? h(EvidenceLabel, { kind: p.evidence }) : null),
      h("h3", { className: "zq-title" }, p.title),
      p.summary ? h("p", { className: "zq-meta" }, p.summary) : null,
      h("div", null, h("span", { className: "zq-datelabel" }, PREC[pr] + (p.dateLabel ? " · " + p.dateLabel : "")), h(DateTrack, { precision: pr, start: p.start, end: p.end })),
      h("p", { className: "zq-meta" }, "Location: ", h("b", { style: { color: "var(--ink)" } }, p.place || "Unknown location")),
      p.references ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, p.references.map(function (r, i) { return h(CitationChip, { key: i }, r); })) : null);
  }

  function ProphetCard(p) {
    return h("a", { className: "zq-card zq-prophet zq-focus", href: p.href || "#", style: { textDecoration: "none", maxWidth: 420 } },
      h(Star, { className: "zq-prophet-mark" }),
      h("div", null,
        h("p", { className: "zq-prophet-name" }, p.name, " ", h("span", { className: "zq-meta", style: { display: "inline" } }, p.honorific || "(عليه السلام)")),
        p.arabicName ? h("div", { className: "zq-prophet-ar", lang: "ar" }, p.arabicName) : null,
        h("div", { className: "zq-order" }, p.order ? "Relative order: " + p.order : "Order: unknown")),
      p.mentions != null ? h("p", { className: "zq-meta", style: { gridColumn: "1 / -1" } }, p.mentions) : null);
  }

  var LEG = [
    ["point", "Verified point", h("svg", { viewBox: "0 0 28 20", key: "a" }, h("circle", { cx: 14, cy: 10, r: 5, fill: "var(--map-point)", stroke: "var(--surface-raised)", strokeWidth: 2 }))],
    ["region", "Approximate region", h("svg", { viewBox: "0 0 28 20", key: "b" }, [h("defs", { key: 0 }, h("pattern", { id: "zqh", width: 4, height: 4, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, h("rect", { width: 1.5, height: 4, fill: "var(--slate)" }))), h("rect", { key: 1, x: 3, y: 3, width: 22, height: 14, rx: 6, fill: "var(--map-region)" }), h("rect", { key: 2, x: 3, y: 3, width: 22, height: 14, rx: 6, fill: "url(#zqh)", stroke: "var(--slate)", strokeWidth: 1.5 })])],
    ["unknown", "Unknown location", h("svg", { viewBox: "0 0 28 20", key: "c" }, [h("circle", { key: 1, cx: 14, cy: 10, r: 7, fill: "none", stroke: "var(--ev-unknown)", strokeWidth: 2, strokeDasharray: "2 3" }), h("text", { key: 2, x: 14, y: 14, textAnchor: "middle", fontSize: 11, fontWeight: 700, fill: "var(--ev-unknown)", fontFamily: "var(--font-sans)" }, "?")])],
    ["hypothesis", "Historical hypothesis", h("svg", { viewBox: "0 0 28 20", key: "d" }, h("rect", { x: 3, y: 3, width: 22, height: 14, rx: 6, fill: "none", stroke: "var(--map-hypothesis)", strokeWidth: 2, strokeDasharray: "1 3", strokeLinecap: "round" }))],
    ["route", "Approximate route", h("svg", { viewBox: "0 0 28 20", key: "e" }, h("path", { d: "M2 14C9 4 18 16 26 6", fill: "none", stroke: "var(--map-route)", strokeWidth: 2.5, strokeDasharray: "5 3" }))]
  ];
  function MapLegend(p) {
    var show = p.items || ["point", "region", "unknown", "hypothesis"];
    return h("section", { className: "zq-legend", "aria-label": "Map legend" }, h("h3", null, p.title || "Location certainty"),
      h("ul", null, LEG.filter(function (l) { return show.indexOf(l[0]) > -1; }).map(function (l) { return h("li", { key: l[0] }, l[2], l[1]); })),
      h("p", { className: "zq-legend-attr", style: { margin: 0 } }, p.attribution || "Map data attribution shown here"));
  }

  function Node(n) { return h("button", { className: cx("zq-node", n.unknown && "zq-node-unknown"), "aria-current": n.current || undefined, onClick: n.onClick }, h("span", { className: "zq-node-name" }, n.name), n.generation ? h("span", { className: "zq-node-gen" }, n.generation) : null); }
  var LINK = { verified: "Sourced link", disputed: "Disputed link", unknown: "Unknown link" };
  function GenealogyLink(p) {
    var s = p.status || "verified";
    return h("div", { className: "zq-gen", role: "group", "aria-label": p.from.name + " to " + p.to.name + ": " + LINK[s] },
      h(Node, p.from),
      h("span", { className: "zq-edge zq-edge-" + s }, h("span", { className: "zq-edge-label" }, p.relation || "parent of"), h("span", { className: "zq-edge-line" }), h("span", { className: "zq-edge-label" }, LINK[s])),
      h(Node, p.to));
  }

  var ST = { draft: "Draft", in_review: "In scholarly review", approved: "Approved", published: "Published", correction: "Correction pending", rejected: "Changes requested" };
  function EditorialStatus(p) { var s = p.status || "draft"; return h("span", { className: "zq-status zq-status-" + s }, h("span", { className: "zq-status-dot", "aria-hidden": "true" }), p.children || ST[s]); }

  function Comment(p) {
    var st = p.status || "visible";
    var initials = (p.author || "?").split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2);
    return h("article", { className: "zq-comment" },
      h("span", { className: "zq-avatar", "aria-hidden": "true" }, initials),
      h("div", null,
        h("div", { className: "zq-comment-head" }, h("span", { className: "zq-comment-author" }, p.author), p.role ? h(EditorialStatus, { status: "approved" }, p.role) : null, h("span", { className: "zq-meta" }, p.time), p.edited ? h("span", { className: "zq-meta" }, "· edited") : null),
        st === "visible" ? h("p", { className: "zq-comment-body" }, p.body) : h("p", { className: "zq-comment-removed" }, st === "hidden" ? "Hidden while a moderator reviews a report." : "Removed by a moderator for breaking the discussion guidelines."),
        st === "visible" && p.citation ? h("div", { style: { marginBottom: 8 } }, h(CitationChip, { kind: "Cites" }, p.citation)) : null,
        st === "visible" ? h("div", { style: { display: "flex", gap: 4 } }, h("button", { className: "zq-iconbtn" }, ICON.discuss(), "Reply"), h("button", { className: "zq-iconbtn", onClick: p.onReport }, ICON.flag(), "Report")) : null));
  }

  function TextField(p) {
    var id = p.id || "zq-f-" + (p.label || "").replace(/\W+/g, "-").toLowerCase();
    return h("div", { className: "zq-field" }, h("label", { htmlFor: id }, p.label),
      h("input", { id: id, className: "zq-input", type: p.type || "text", placeholder: p.placeholder, defaultValue: p.value, disabled: p.disabled, dir: p.dir, "aria-invalid": p.error ? "true" : undefined, "aria-describedby": id + "-d" }),
      p.error ? h("span", { className: "zq-error", id: id + "-d" }, ICON.alert(), p.error) : p.help ? h("span", { className: "zq-help", id: id + "-d" }, p.help) : null);
  }
  function SearchField(p) {
    return h("form", { role: "search", className: "zq-field zq-search", style: { maxWidth: p.maxWidth || 520 }, onSubmit: function (e) { e.preventDefault(); } },
      h("label", { htmlFor: "zq-q", className: "zq-sr", style: { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } }, p.label || "Search ZIQ"),
      ICON.search(), h("input", { id: "zq-q", className: "zq-input", type: "search", placeholder: p.placeholder || "Search prophets, surahs, hadith, places…", defaultValue: p.value }));
  }

  function Skeleton(p) { return h("div", { className: "zq-skel", "aria-hidden": "true", style: { width: p.width || "100%", height: p.height || 16, borderRadius: p.round ? "var(--radius-pill)" : undefined } }); }

  function Toast(p) {
    var t = p.tone || "info";
    return h("div", { className: "zq-toast", role: t === "error" ? "alert" : "status" }, t === "error" ? ICON.alert() : ICON.check(), h("span", null, p.children), p.action ? h("button", { onClick: p.onAction }, p.action) : null);
  }

  function EvidenceDrawer(p) {
    var tabs = p.tabs || [];
    var sel = useState(0);
    return h("aside", { className: "zq-drawer", role: "dialog", "aria-label": "Evidence for this claim" },
      h("div", { className: "zq-drawer-head" }, h("div", null, h("p", { className: "zq-eyebrow" }, "Evidence"), h("p", { className: "zq-drawer-claim" }, p.claim), p.status ? h("div", { style: { marginTop: 8 } }, h(EvidenceLabel, { kind: p.status })) : null),
        h("button", { className: "zq-iconbtn", "aria-label": "Close evidence", onClick: p.onClose }, ICON.close())),
      h("div", { className: "zq-tabs", role: "tablist" }, tabs.map(function (t, i) { return h("button", { key: i, role: "tab", className: "zq-tab", "aria-selected": sel[0] === i, onClick: function () { sel[1](i); } }, t.label + (t.count != null ? " (" + t.count + ")" : "")); })),
      h("div", { className: "zq-drawer-body", role: "tabpanel" }, tabs[sel[0]] ? tabs[sel[0]].content : null),
      h("div", { className: "zq-drawer-foot" }, p.footer || "Reviewed content · see methodology"));
  }


  /* Vertical timeline: Adam at the top, today at the bottom. Ordered, NOT to scale. */
  var VT_MARK = { exact: "zq-vt-dot", range: "zq-vt-bar", estimated: "zq-vt-bar zq-vt-est", relative: "zq-vt-dia", unknown: "zq-vt-unk" };
  function VerticalTimeline(p) {
    var eras = p.eras || [];
    return h("section", { className: "zq-vt", "aria-label": p.label || "Timeline from Adam to today" },
      h("p", { className: "zq-vt-scale" }, "Ordered from Adam to today · not to scale"),
      h("ol", { className: "zq-vt-list" },
        eras.map(function (era, ei) {
          return h("li", { key: ei, className: cx("zq-vt-era", "zq-vt-era-" + (era.kind || "dated")) },
            h("div", { className: "zq-vt-erahead" },
              h("p", { className: "zq-eyebrow" }, era.title),
              h("p", { className: "zq-meta" }, era.kind === "relative" ? (era.note || "Relative order only — no dates are known") : era.kind === "undated-future" ? (era.note || "No date is known. Order follows the texts only.") : (era.note || ""))),
            h("ol", { className: "zq-vt-items" }, (era.items || []).map(function (it, ii) {
              var pr = it.precision || (era.kind === "relative" ? "relative" : "unknown");
              return h("li", { key: ii, className: cx("zq-vt-item", it.selected && "zq-vt-sel") },
                h("span", { className: "zq-vt-mark " + VT_MARK[pr], "aria-hidden": "true" }),
                h("button", { className: "zq-vt-btn", onClick: it.onClick, "aria-current": it.selected || undefined },
                  h("span", { className: "zq-vt-when" }, it.dateLabel || PREC[pr]),
                  h("span", { className: "zq-vt-title" }, it.title),
                  it.evidence ? h(EvidenceLabel, { kind: it.evidence }) : null));
            })),
            era.breakAfter ? h("div", { className: "zq-vt-break", role: "separator" }, h("span", null, era.breakAfter)) : null);
        }),
        p.today !== false ? h("li", { className: "zq-vt-today" }, h("span", { className: "zq-vt-mark zq-vt-now", "aria-hidden": "true" }), h("span", { className: "zq-vt-title" }, "Today"), h("span", { className: "zq-vt-when" }, p.today || "")) : null));
  }

  /* ---------- Journey (glass) ---------- */
  function Rosette(p) {
    var n = p.points || 8, R = 11, r = R * (n >= 12 ? 0.72 : n >= 10 ? 0.66 : 0.58), pts = [];
    for (var i = 0; i < n * 2; i++) { var a = Math.PI * i / n - Math.PI / 2, rr = i % 2 ? r : R; pts.push((12 + rr * Math.cos(a)).toFixed(2) + "," + (12 + rr * Math.sin(a)).toFixed(2)); }
    return h("svg", { viewBox: "0 0 24 24", className: p.className, "aria-hidden": "true", focusable: "false" },
      h("polygon", { points: pts.join(" "), fill: "none", stroke: "currentColor", strokeWidth: 1.1, strokeLinejoin: "round" }),
      h("circle", { cx: 12, cy: 12, r: r * 0.45, fill: "none", stroke: "currentColor", strokeWidth: 0.9 }));
  }
  var ERA_TXT = { relative: "Chronological position", estimate: "Historians' estimate", traditional: "Traditional estimate", exact: "Established date", unknown: "Date unknown", disputed: "Date disputed" };
  var ERA_KIND = { relative: "estimate", estimate: "estimate", traditional: "scholar", exact: "hadith", unknown: "unknown", disputed: "disputed" };
  var PLACE_TXT = { point: "Verified place", region: "Approximate region", hypothesis: "Historical hypothesis", disputed: "Disputed location", unknown: "Location unknown" };
  function EraTag(p) { return h("span", { className: "zq-era zq-era-" + p.certainty }, h("span", { className: "zq-era-mark", "aria-hidden": "true" }), h("span", null, p.label), h("span", { className: "zq-era-kind" }, "· " + ERA_TXT[p.certainty])); }

  var REF_KIND = { quran: "Quran", hadith: "Hadith", scholar: "Scholarship" };
  function ProphetJourneyCard(p) {
    var ex = p.expanded !== false, ms = p.type === "milestone";
    var head = h("div", { className: "zq-jc-head" },
      h(Rosette, { points: p.points, className: "zq-jc-motif" }),
      h("div", { className: "zq-jc-id" },
        h("div", { className: "zq-jc-top" }, p.chapter ? h("span", { className: "zq-jc-chap" }, (ms ? "Milestone " : "Chapter ") + p.chapter) : null, h(EraTag, p.era || { label: "", certainty: "unknown" })),
        h("h3", { className: "zq-jc-name" }, p.name, p.honorific ? h("span", { className: "zq-jc-hon", lang: "ar" }, " " + p.honorific) : null),
        h("p", { className: "zq-jc-sub" }, h("span", { className: "zq-jc-ar", lang: "ar", dir: "rtl" }, p.arabicName), p.subtitle ? " · " + p.subtitle : "")),
      p.onToggle ? h("button", { className: "zq-jc-toggle", "aria-expanded": ex, "aria-label": (ex ? "Collapse " : "Expand ") + p.name, onClick: p.onToggle }, svg({}, h("path", { d: ex ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: 1.6 }))) : null);
    if (!ex) return h("article", { className: cx("zq-jc zq-glass zq-jc-collapsed", ms && "zq-jc-ms"), id: p.id }, head);
    var surahs = p.surahs && p.surahs.length ? h("div", { className: "zq-jc-sec" }, h("p", { className: "zq-jc-label" }, "Related surahs"),
        h("ul", { className: "zq-jc-surahs" }, p.surahs.map(function (s, i) {
          return h("li", { key: i, className: "zq-jc-surah" },
            h("span", { className: "zq-jc-snum" }, s.number),
            h("span", { className: "zq-jc-sname" }, h("b", null, s.name), h("span", { lang: "ar", dir: "rtl", className: "zq-jc-sar" }, s.arabic), s.named ? h("span", { className: "zq-jc-named" }, "Named after him") : null),
            h("span", { className: "zq-jc-pass" }, s.passages.map(function (ps, j) { return h(CitationChip, { key: j, ariaLabel: "Quran " + ps }, "Q " + ps); })));
        }))) : null;
    var refs = p.refs && p.refs.length ? h("div", { className: "zq-jc-sec" }, h("p", { className: "zq-jc-label" }, "Sources"),
        h("ul", { className: "zq-jc-refs" }, p.refs.map(function (r, i) { return h("li", { key: i }, h(CitationChip, { kind: REF_KIND[r.kind] }, r.ref), h("span", null, r.label)); }))) : null;
    return h("article", { className: cx("zq-jc zq-glass", ms && "zq-jc-ms"), id: p.id, "aria-label": p.name },
      head,
      p.ageMarker ? h("p", { className: "zq-jc-age" }, h("span", { className: "zq-jc-label" }, "Age marker"), p.ageMarker) : null,
      h("p", { className: "zq-jc-sum" }, p.summary),
      p.milestones ? h("ol", { className: "zq-jc-miles" }, p.milestones.map(function (m, i) { return h("li", { key: i }, h("span", { className: "zq-jc-when" }, m.when), h("span", null, m.text), h("span", { className: "zq-era-kind" }, ERA_TXT[m.certainty])); })) : null,
      surahs, refs,
      h("div", { className: "zq-jc-meta" },
        h("span", { className: "zq-jc-place zq-jc-place-" + (p.place ? p.place.certainty : "unknown") }, h("span", { className: "zq-jc-pmark", "aria-hidden": "true" }), h("span", null, h("b", null, PLACE_TXT[p.place ? p.place.certainty : "unknown"] + ": "), p.place ? p.place.name : "Unknown")),
        h("span", { className: "zq-jc-ev" }, (p.evidence || ["quran"]).map(function (k) { return h(EvidenceLabel, { key: k, kind: k }); }), p.order && p.order.disputed ? h(EvidenceLabel, { kind: "disputed" }, p.order.label) : null)),
      p.note ? h("p", { className: "zq-jc-note" }, h(EvidenceLabel, { kind: "scholar" }, "Note"), " ", p.note) : null,
      h("div", { className: "zq-jc-cta" }, h(Button, { variant: "primary", size: "sm", onClick: p.onExplore }, "Explore story"), h(Button, { size: "sm", icon: "source", onClick: p.onEvidence }, "View evidence")));
  }

  var JT_FILTERS = [["all", "Complete journey"], ["prophet", "Prophets"], ["milestone", "Key events"], ["dated", "Dated history"]];
  function evidenceTabs(it) {
    var q = [], hd = [], sc = [];
    (it.surahs || []).forEach(function (s) { s.passages.forEach(function (ps) { q.push({ ref: "Q " + ps, label: s.name + (s.named ? " — named after him" : "") }); }); });
    (it.refs || []).forEach(function (r) { (r.kind === "quran" ? q : r.kind === "hadith" ? hd : sc).push(r); });
    function list(a, empty) { return a.length ? h("ul", { className: "zq-jc-refs" }, a.map(function (r, i) { return h("li", { key: i }, h(CitationChip, null, r.ref), h("span", null, r.label)); })) : h("p", { className: "zq-meta" }, empty); }
    var notes = [h("p", { key: 0, className: "zq-meta" }, h("b", { style: { color: "var(--ink)" } }, "Date: "), it.era.label + " — " + ERA_TXT[it.era.certainty]),
      h("p", { key: 1, className: "zq-meta" }, h("b", { style: { color: "var(--ink)" } }, PLACE_TXT[it.place ? it.place.certainty : "unknown"] + ": "), it.place ? it.place.name : "Unknown")];
    if (it.order) notes.push(h("p", { key: 2, className: "zq-meta" }, it.order.label));
    if (it.note) notes.push(h("p", { key: 3, className: "zq-meta" }, it.note));
    sc.forEach(function (r, i) { notes.push(h("p", { key: "s" + i, className: "zq-meta" }, r.ref + " — " + r.label)); });
    return [{ label: "Quran", count: q.length, content: list(q, "No Quran passage attached.") }, { label: "Hadith", count: hd.length, content: list(hd, "No narration attached to this stop yet.") }, { label: "Context", content: h("div", null, notes) }];
  }

  function JourneyTimeline(p) {
    var all = []; (p.eras || []).forEach(function (e) { e.items.forEach(function (it) { all.push(it); }); });
    var fs = useState("all"), filter = fs[0], setFilter = fs[1];
    var st = useState(p.initialActive || (all[0] && all[0].id)), active = st[0], setActive = st[1];
    var ev = useState(null), evItem = ev[0], setEv = ev[1];
    var root = React.useRef(null), fill = React.useRef(null), bg = React.useRef(null), lastFocus = React.useRef(null), hold = React.useRef(0), cur = React.useRef(active);
    cur.current = active;
    function pick(id) { hold.current = Date.now() + 1200; setActive(id); }
    var reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function show(it) { return filter === "all" || (filter === "dated" ? it.dated : (it.type || "prophet") === filter); }
    var vis = all.filter(show).map(function (it) { return it.id; });
    React.useEffect(function () {
      var el = root.current; if (!el) return;
      var node = el.querySelector('[data-node="' + active + '"]'), line = el.querySelector(".zq-jt-line");
      if (node && line && fill.current) requestAnimationFrame(function () { fill.current.style.height = Math.max(0, node.getBoundingClientRect().top - line.getBoundingClientRect().top + 20) + "px"; });
    }, [active, filter]);
    React.useEffect(function () {
      var el = root.current; if (!el) return;
      var io = null;
      if (!reduce && "IntersectionObserver" in window) {
        io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("zq-in"); io.unobserve(e.target); } }); }, { threshold: 0.08 });
        el.querySelectorAll(".zq-jt-item:not(.zq-in)").forEach(function (n) { if (n.getBoundingClientRect().top > innerHeight) { n.classList.add("zq-rv"); io.observe(n); } else n.classList.add("zq-in"); });
      }
      return function () { if (io) io.disconnect(); };
    }, [filter]);
    React.useEffect(function () {
      var el = root.current, last = window.scrollY, raf = 0;
      function onScroll() {
        if (raf) return; raf = requestAnimationFrame(function () {
          raf = 0;
          if (!reduce && bg.current) bg.current.style.transform = "translate3d(0," + (window.scrollY * -0.08).toFixed(1) + "px,0)";
          el.querySelectorAll(".zq-rv:not(.zq-in)").forEach(function (n) { if (n.getBoundingClientRect().top < innerHeight) n.classList.add("zq-in"); });
          if (p.scrollSync === false || Date.now() < hold.current || document.querySelector(".zq-jt-modal") || Math.abs(window.scrollY - last) < 4) return; last = window.scrollY;
          var mid = innerHeight * 0.4, best = null, bd = 1e9, cd = 1e9;
          el.querySelectorAll("[data-node]").forEach(function (n) { var id = n.getAttribute("data-node"), d = Math.abs(n.getBoundingClientRect().top - mid); if (id === cur.current) cd = d; if (d < bd) { bd = d; best = id; } });
          if (best && best !== cur.current && bd < cd - 48) setActive(best);
        });
      }
      addEventListener("scroll", onScroll, { passive: true });
      return function () { removeEventListener("scroll", onScroll); };
    }, []);
    React.useEffect(function () {
      if (!evItem) return;
      function onKey(e) { if (e.key === "Escape") closeEv(); }
      addEventListener("keydown", onKey);
      var c = document.querySelector(".zq-jt-modal .zq-iconbtn"); if (c) c.focus();
      return function () { removeEventListener("keydown", onKey); };
    }, [evItem]);
    function openEv(it) { lastFocus.current = document.activeElement; setEv(it); }
    function closeEv() { setEv(null); if (lastFocus.current && lastFocus.current.focus) lastFocus.current.focus(); }
    function jump(id) { pick(id); var n = root.current.querySelector('[data-node="' + id + '"]'); if (n && n.scrollIntoView) n.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); }
    var idx = vis.indexOf(active), side = 0;
    return h("section", { className: "zq-jt", "data-theme": p.theme || "journey", ref: root, "aria-label": p.label || "Journey of the prophets" },
      h("div", { className: "zq-jt-bg", ref: bg, "aria-hidden": "true" }),
      p.intro ? h("div", { className: "zq-jt-intro" }, p.intro) : null,
      p.filters === false ? null : h("div", { className: "zq-jt-filters zq-glass", role: "group", "aria-label": "Show" }, h("span", { className: "zq-jt-flabel" }, "Explore by"),
        JT_FILTERS.map(function (f) { return h("button", { key: f[0], className: "zq-jt-filter", "aria-pressed": filter === f[0], onClick: function () { setFilter(f[0]); var nv = all.filter(function (it) { return f[0] === "all" || (f[0] === "dated" ? it.dated : (it.type || "prophet") === f[0]); }); if (nv.length && !nv.some(function (it) { return it.id === active; })) pick(nv[0].id); } }, f[1]); })),
      h("div", { className: "zq-jt-progress", role: "progressbar", "aria-label": "Journey progress", "aria-valuemin": 1, "aria-valuemax": vis.length, "aria-valuenow": Math.max(1, idx + 1) },
        h("span", { style: { width: (Math.max(1, idx + 1) / Math.max(1, vis.length) * 100) + "%" } }), h("b", null, Math.max(1, idx + 1) + " / " + vis.length)),
      h("div", { className: "zq-jt-body" },
        h("nav", { className: "zq-jt-rail zq-glass", "aria-label": "Jump to a stop" },
          h("p", { className: "zq-jt-rail-title" }, "Your journey"),
          h("ol", null, (p.eras || []).map(function (e, ei) {
            var items = e.items.filter(show); if (!items.length) return null;
            return h("li", { key: ei }, h("p", { className: "zq-jt-rail-era" }, e.title),
              h("ol", null, items.map(function (it) { return h("li", { key: it.id }, h("button", { className: "zq-jt-rail-btn", "aria-current": it.id === active || undefined, onClick: function () { jump(it.id); } }, it.name)); })));
          }))),
        h("ol", { className: "zq-jt-line" },
          h("span", { className: "zq-jt-track", "aria-hidden": "true" }), h("span", { className: "zq-jt-fill", ref: fill, "aria-hidden": "true" }),
          (p.eras || []).map(function (e, ei) {
            var items = e.items.filter(show); if (!items.length) return null;
            return [h("li", { key: "e" + ei, className: "zq-jt-era" }, h("div", { className: "zq-jt-era-pill zq-glass" }, h("p", { className: "zq-eyebrow" }, String(ei + 1).padStart(2, "0") + " / " + e.title), e.note ? h("p", { className: "zq-jt-era-note" }, e.note) : null))]
              .concat(items.map(function (it) {
                var isA = it.id === active, s = side++ % 2 ? "r" : "l";
                return h("li", { key: it.id, className: cx("zq-jt-item", "zq-jt-" + s, isA && "zq-jt-active", it.type === "milestone" && "zq-jt-ms") },
                  h("button", { className: "zq-jt-node", "data-node": it.id, "aria-label": it.name + (isA ? " — details shown" : " — show details"), "aria-expanded": isA, onClick: function () { pick(it.id); } }, h(Rosette, { points: it.points })),
                  h("div", { className: "zq-jt-card" }, h(ProphetJourneyCard, Object.assign({}, it, { expanded: isA, onToggle: function () { pick(it.id); }, onEvidence: function () { hold.current = Date.now() + 1200; openEv(it); }, onExplore: p.onExplore ? function () { p.onExplore(it); } : undefined }))),
                  h("div", { className: "zq-jt-when" }, h("strong", null, it.era.label), h("span", null, ERA_TXT[it.era.certainty])));
              }));
          }),
          p.endLabel !== false ? h("li", { className: "zq-jt-end" }, h("div", { className: "zq-jt-era-pill zq-glass" }, h("p", { className: "zq-eyebrow" }, p.endLabel || "The journey continues"), p.endNote ? h("p", { className: "zq-jt-era-note" }, p.endNote) : null, p.endActions || null)) : null)),
      evItem ? window.ReactDOM.createPortal(h("div", { className: "zq-jt-modal", "data-theme": p.theme || "journey", role: "presentation", onClick: function (e) { if (e.target === e.currentTarget) closeEv(); } },
        h(EvidenceDrawer, { claim: evItem.name + " — " + evItem.summary, status: (evItem.evidence || ["quran"])[0], onClose: closeEv, tabs: evidenceTabs(evItem), footer: "Draft — references to be verified and approved by the scholarly reviewer before publishing." })), document.body) : null);
  }

  window.ZIQ = Object.assign(window.ZIQ || {}, { Button: Button, EvidenceLabel: EvidenceLabel, CitationChip: CitationChip, HadithGrade: HadithGrade, VerseCard: VerseCard, HadithCard: HadithCard, EventCard: EventCard, ProphetCard: ProphetCard, MapLegend: MapLegend, GenealogyLink: GenealogyLink, EditorialStatus: EditorialStatus, Comment: Comment, TextField: TextField, SearchField: SearchField, Skeleton: Skeleton, Toast: Toast, EvidenceDrawer: EvidenceDrawer, VerticalTimeline: VerticalTimeline, ProphetJourneyCard: ProphetJourneyCard, JourneyTimeline: JourneyTimeline, Rosette: Rosette, EraTag: EraTag, EvidenceMark: function (p) { return MARKS[p.kind || "unknown"](p); }, Star: Star });
})();
