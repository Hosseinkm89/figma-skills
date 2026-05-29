/**
 * Accessibility Contrast Audit — standalone Figma plugin (no build step).
 * ---------------------------------------------------------------------------
 * Runs on the CURRENT PAGE. Scores text contrast against WCAG AA/AAA and flags
 * low-contrast UI strokes, then creates a new report page with one PASS/FAIL row
 * per frame and a clickable link to each frame. It never changes your designs.
 *
 * To change behaviour, edit the OPTIONS object at the very bottom of this file.
 * The runContrastAudit function below is identical to ../contrast-audit.js,
 * inlined so it runs as-is. Do not edit it by hand — regenerate from the source.
 * ---------------------------------------------------------------------------
 */

/**
 * Run a WCAG contrast audit on the current page and build a report page.
 *
 * @param {Object}  [options]
 * @param {boolean} [options.includeNonText=true]  Also check UI/non-text strokes
 *                                                  against the 3:1 rule (1.4.11).
 * @param {boolean} [options.switchToReport=true]   Open the report page when done.
 * @param {Object}  [options.defaultBackground]     {r,g,b} 0–1 used when no solid
 *                                                  background can be found behind
 *                                                  an element (defaults to white).
 * @returns {Promise<Object>} summary with per-frame results.
 */
async function runContrastAudit(options) {
  const {
    includeNonText = true,
    switchToReport = true,
    defaultBackground = { r: 1, g: 1, b: 1 },
  } = options || {};

  // Big speed-up on large files: don't traverse hidden instance internals.
  figma.skipInvisibleInstanceChildren = true;

  const sourcePage = figma.currentPage;

  // =========================================================================
  // 1. COLOR + CONTRAST MATH (WCAG 2.1)
  // =========================================================================

  // Convert one 0–1 sRGB channel to linear light (WCAG relative-luminance step).
  const toLinear = (c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  // Relative luminance of an {r,g,b} color (channels in 0–1).
  const luminance = ({ r, g, b }) =>
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // WCAG contrast ratio between two opaque colors. Always >= 1, max 21.
  const contrast = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  };

  // Alpha-composite a (possibly translucent) foreground over an opaque bg.
  const over = (fg, alpha, bg) => ({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  });

  const round2 = (n) => Math.round(n * 100) / 100;

  // WCAG thresholds.
  const AA_NORMAL = 4.5;
  const AA_LARGE = 3.0;
  const AAA_NORMAL = 7.0;
  const AAA_LARGE = 4.5;
  const NON_TEXT_MIN = 3.0; // 1.4.11

  // =========================================================================
  // 2. COLOR EXTRACTION HELPERS
  // =========================================================================

  // First visible SOLID paint in a fills/strokes array → {color, opacity} | null.
  const firstSolid = (paints) => {
    if (!Array.isArray(paints)) return null;
    for (let i = paints.length - 1; i >= 0; i--) {
      const p = paints[i];
      if (p && p.type === 'SOLID' && p.visible !== false) {
        return { color: p.color, opacity: p.opacity == null ? 1 : p.opacity };
      }
    }
    return null;
  };

  // Walk up the ancestor chain to find the effective background color behind a
  // node. Composites stacked translucent solid fills; falls back to the page's
  // default background when nothing solid is found.
  const backgroundBehind = (node) => {
    let result = null; // accumulate from far→near, so start as null
    let parent = node.parent;
    const stack = [];
    while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
      stack.push(parent);
      parent = parent.parent;
    }
    // Composite from the outermost ancestor inward.
    let bg = { ...defaultBackground };
    for (let i = stack.length - 1; i >= 0; i--) {
      const anc = stack[i];
      const solid = firstSolid(anc.fills);
      const ancOpacity = typeof anc.opacity === 'number' ? anc.opacity : 1;
      if (solid) {
        const a = solid.opacity * ancOpacity;
        bg = over(solid.color, a, bg);
        result = bg;
      }
    }
    return result || { ...defaultBackground };
  };

  // Is this text run "large" per WCAG? >=24px regular, or >=18.66px bold.
  // (WCAG defines large text as >=18pt / >=14pt bold; 1pt ≈ 1.333px.)
  const isLargeRun = (fontSize, fontWeight, fontName) => {
    const size = typeof fontSize === 'number' ? fontSize : 0;
    const weightNum = typeof fontWeight === 'number' ? fontWeight : 400;
    const styleStr = (fontName && fontName.style ? fontName.style : '').toLowerCase();
    const bold =
      weightNum >= 700 ||
      /bold|black|heavy|extrabold|ultra/.test(styleStr);
    if (bold) return size >= 18.66;
    return size >= 24;
  };

  const isWhitespace = (s) => !s || /^\s*$/.test(s);

  // =========================================================================
  // 3. AUDIT ONE FRAME
  // =========================================================================

  const auditFrame = (frame) => {
    const res = {
      name: frame.name,
      id: frame.id,
      // text
      textRuns: 0,
      textFailAA: 0,
      textFailAAA: 0,
      textSkipped: 0, // gradient/image text fills we can't score
      minTextRatio: Infinity,
      worst: null, // { text, ratio, required, color, bg }
      // non-text
      uiChecked: 0,
      uiFail: 0,
      uiMinRatio: Infinity,
    };

    // --- Text contrast ------------------------------------------------------
    const textNodes = frame.findAll((n) => n.type === 'TEXT' && n.visible !== false);
    for (const t of textNodes) {
      const tOpacity = typeof t.opacity === 'number' ? t.opacity : 1;
      const bg = backgroundBehind(t);
      let segments;
      try {
        segments = t.getStyledTextSegments(['fills', 'fontSize', 'fontName', 'fontWeight']);
      } catch (e) {
        continue; // unreadable text node — skip
      }
      for (const seg of segments) {
        if (isWhitespace(seg.characters)) continue;
        const solid = firstSolid(seg.fills);
        if (!solid) {
          res.textSkipped++;
          continue; // gradient/image text — can't score a single ratio
        }
        res.textRuns++;
        const alpha = solid.opacity * tOpacity;
        const fg = over(solid.color, alpha, bg);
        const ratio = contrast(fg, bg);
        const large = isLargeRun(seg.fontSize, seg.fontWeight, seg.fontName);
        const reqAA = large ? AA_LARGE : AA_NORMAL;
        const reqAAA = large ? AAA_LARGE : AAA_NORMAL;
        if (ratio + 0.005 < reqAA) res.textFailAA++;
        if (ratio + 0.005 < reqAAA) res.textFailAAA++;
        if (ratio < res.minTextRatio) {
          res.minTextRatio = ratio;
          res.worst = {
            text: seg.characters.trim().slice(0, 40),
            ratio: round2(ratio),
            requiredAA: reqAA,
            large,
          };
        }
      }
    }
    if (res.minTextRatio === Infinity) res.minTextRatio = null;

    // --- Non-text / UI contrast (heuristic) --------------------------------
    if (includeNonText) {
      const UI_TYPES = [
        'RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'LINE', 'VECTOR',
        'FRAME', 'COMPONENT', 'INSTANCE',
      ];
      const uiNodes = frame.findAll(
        (n) => UI_TYPES.indexOf(n.type) !== -1 && n.visible !== false
      );
      for (const n of uiNodes) {
        const stroke = firstSolid(n.strokes);
        if (!stroke) continue; // only score elements with a visible solid stroke
        const weight =
          typeof n.strokeWeight === 'number' && n.strokeWeight > 0
            ? n.strokeWeight
            : 1;
        if (weight <= 0) continue;
        const nOpacity = typeof n.opacity === 'number' ? n.opacity : 1;
        const bg = backgroundBehind(n);
        const alpha = stroke.opacity * nOpacity;
        const fg = over(stroke.color, alpha, bg);
        const ratio = contrast(fg, bg);
        res.uiChecked++;
        if (ratio < res.uiMinRatio) res.uiMinRatio = ratio;
        if (ratio + 0.005 < NON_TEXT_MIN) res.uiFail++;
      }
    }
    if (res.uiMinRatio === Infinity) res.uiMinRatio = null;

    // --- Verdicts -----------------------------------------------------------
    res.passAA = res.textRuns > 0 ? res.textFailAA === 0 : null;
    res.passAAA = res.textRuns > 0 ? res.textFailAAA === 0 : null;
    res.passNonText = res.uiChecked > 0 ? res.uiFail === 0 : null;
    return res;
  };

  // =========================================================================
  // 4. RUN THE AUDIT
  // =========================================================================

  // Audit only top-level containers (frames, components, sections). Loose
  // shapes/text sitting directly on the canvas are skipped — they aren't a
  // "screen" to report on.
  const AUDIT_TOP_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'SECTION', 'INSTANCE'];
  const topFrames = sourcePage.children.filter(
    (n) => AUDIT_TOP_TYPES.indexOf(n.type) !== -1 && n.visible !== false
  );

  const results = topFrames.map(auditFrame);

  // =========================================================================
  // 5. FONTS FOR THE REPORT
  // =========================================================================

  // Pick a font that is actually installed, then load the weights we need.
  const pickFonts = async () => {
    const tryFamily = async (family, styles) => {
      try {
        await Promise.all(styles.map((s) => figma.loadFontAsync({ family, style: s })));
        return true;
      } catch (e) {
        return false;
      }
    };
    if (await tryFamily('Inter', ['Regular', 'Medium', 'Semi Bold', 'Bold'])) {
      return {
        regular: { family: 'Inter', style: 'Regular' },
        medium: { family: 'Inter', style: 'Medium' },
        semibold: { family: 'Inter', style: 'Semi Bold' },
        bold: { family: 'Inter', style: 'Bold' },
      };
    }
    if (await tryFamily('Roboto', ['Regular', 'Medium', 'Bold'])) {
      return {
        regular: { family: 'Roboto', style: 'Regular' },
        medium: { family: 'Roboto', style: 'Medium' },
        semibold: { family: 'Roboto', style: 'Medium' },
        bold: { family: 'Roboto', style: 'Bold' },
      };
    }
    // Fallback: first available font; reuse its first style for every weight.
    const available = await figma.listAvailableFontsAsync();
    const f = available[0].fontName;
    await figma.loadFontAsync(f);
    return { regular: f, medium: f, semibold: f, bold: f };
  };

  const FONT = await pickFonts();

  // =========================================================================
  // 6. REPORT BUILDING HELPERS
  // =========================================================================

  const hex = (h) => {
    const v = h.replace('#', '');
    return {
      r: parseInt(v.slice(0, 2), 16) / 255,
      g: parseInt(v.slice(2, 4), 16) / 255,
      b: parseInt(v.slice(4, 6), 16) / 255,
    };
  };

  // Palette (all UI colors here pass contrast against their own backgrounds).
  const C = {
    pageBg: hex('#F4F5F7'),
    card: hex('#FFFFFF'),
    ink: hex('#101828'),
    sub: hex('#475467'),
    muted: hex('#667085'),
    line: hex('#E4E7EC'),
    passBg: hex('#DCFCE7'),
    passInk: hex('#166534'),
    failBg: hex('#FEE2E2'),
    failInk: hex('#991B1B'),
    naBg: hex('#F1F5F9'),
    naInk: hex('#475569'),
    linkInk: hex('#1D4ED8'),
  };

  const solidPaint = (color) => [{ type: 'SOLID', color }];

  const makeText = (chars, opt) => {
    const o = opt || {};
    const t = figma.createText();
    t.fontName = o.font || FONT.regular;
    t.characters = chars == null ? '' : String(chars);
    t.fontSize = o.size || 14;
    t.fills = solidPaint(o.color || C.ink);
    if (o.lineHeightPct) t.lineHeight = { unit: 'PERCENT', value: o.lineHeightPct };
    return t;
  };

  // A small status pill: kind = 'pass' | 'fail' | 'na'.
  const makeBadge = (kind, labelOverride) => {
    const map = {
      pass: { bg: C.passBg, ink: C.passInk, label: 'PASS' },
      fail: { bg: C.failBg, ink: C.failInk, label: 'FAIL' },
      na: { bg: C.naBg, ink: C.naInk, label: 'N/A' },
    };
    const m = map[kind] || map.na;
    const pill = figma.createFrame();
    pill.name = `Badge / ${m.label}`;
    pill.layoutMode = 'HORIZONTAL';
    pill.primaryAxisSizingMode = 'AUTO';
    pill.counterAxisSizingMode = 'AUTO';
    pill.paddingLeft = 10;
    pill.paddingRight = 10;
    pill.paddingTop = 4;
    pill.paddingBottom = 4;
    pill.cornerRadius = 999;
    pill.fills = solidPaint(m.bg);
    const label = makeText(labelOverride || m.label, {
      font: FONT.semibold,
      size: 11,
      color: m.ink,
    });
    pill.appendChild(label);
    return pill;
  };

  const badgeKind = (pass) => (pass === null ? 'na' : pass ? 'pass' : 'fail');

  // =========================================================================
  // 7. BUILD THE REPORT PAGE
  // =========================================================================

  const today = new Date().toISOString().slice(0, 10);
  const reportPage = figma.createPage();
  reportPage.name = `♿ Contrast Audit — ${today}`;

  // Root column.
  const root = figma.createFrame();
  root.name = 'Contrast Audit Report';
  root.layoutMode = 'VERTICAL';
  // resize() resets auto-layout sizing modes to FIXED, so set the fixed width
  // FIRST, then declare sizing modes (AUTO height = hug content, FIXED width).
  root.resize(960, 100);
  root.primaryAxisSizingMode = 'AUTO';
  root.counterAxisSizingMode = 'FIXED';
  root.itemSpacing = 24;
  root.paddingLeft = 40;
  root.paddingRight = 40;
  root.paddingTop = 40;
  root.paddingBottom = 40;
  root.fills = solidPaint(C.pageBg);
  root.cornerRadius = 16;
  reportPage.appendChild(root);
  root.x = 0;
  root.y = 0;

  // -- Header --------------------------------------------------------------
  const header = figma.createFrame();
  header.name = 'Header';
  header.layoutMode = 'VERTICAL';
  header.itemSpacing = 6;
  header.fills = [];
  root.appendChild(header);
  header.layoutSizingHorizontal = 'FILL';
  header.layoutSizingVertical = 'HUG';

  header.appendChild(
    makeText('Accessibility Contrast Audit', { font: FONT.bold, size: 28, color: C.ink })
  );

  const totalFrames = results.length;
  const aaFails = results.filter((r) => r.passAA === false).length;
  const aaaFails = results.filter((r) => r.passAAA === false).length;
  const subtitle = makeText(
    `Source page: “${sourcePage.name}”   •   ${totalFrames} frame${totalFrames === 1 ? '' : 's'} audited   •   ${today}`,
    { size: 14, color: C.sub }
  );
  header.appendChild(subtitle);
  const headline = makeText(
    `${aaFails} frame${aaFails === 1 ? '' : 's'} fail AA text contrast   •   ${aaaFails} fail AAA`,
    { font: FONT.medium, size: 14, color: aaFails > 0 ? C.failInk : C.passInk }
  );
  header.appendChild(headline);

  // -- Legend card ---------------------------------------------------------
  const legend = figma.createFrame();
  legend.name = 'Legend';
  legend.layoutMode = 'VERTICAL';
  legend.itemSpacing = 6;
  legend.paddingLeft = 20;
  legend.paddingRight = 20;
  legend.paddingTop = 16;
  legend.paddingBottom = 16;
  legend.cornerRadius = 12;
  legend.fills = solidPaint(C.card);
  legend.strokes = solidPaint(C.line);
  legend.strokeWeight = 1;
  root.appendChild(legend);
  legend.layoutSizingHorizontal = 'FILL';
  legend.layoutSizingVertical = 'HUG';

  legend.appendChild(makeText('How to read this', { font: FONT.semibold, size: 14, color: C.ink }));
  const legendLines = [
    'Text AA (WCAG 1.4.3): normal text needs 4.5:1, large text 3:1.',
    'Text AAA (WCAG 1.4.6): normal text needs 7:1, large text 4.5:1.',
    'Large text = 24px+ regular, or 18.66px+ bold.',
    'Non-text (WCAG 1.4.11): UI strokes/borders need 3:1. This column is a heuristic flag for review, not a guarantee.',
    'A frame PASSES a level only if every text run inside it meets that level.',
  ];
  for (const line of legendLines) {
    legend.appendChild(makeText('•  ' + line, { size: 13, color: C.sub, lineHeightPct: 150 }));
  }

  // -- Table ---------------------------------------------------------------
  const table = figma.createFrame();
  table.name = 'Results';
  table.layoutMode = 'VERTICAL';
  table.itemSpacing = 0;
  table.cornerRadius = 12;
  table.clipsContent = true;
  table.fills = solidPaint(C.card);
  table.strokes = solidPaint(C.line);
  table.strokeWeight = 1;
  root.appendChild(table);
  table.layoutSizingHorizontal = 'FILL';
  table.layoutSizingVertical = 'HUG';

  const COL_AA = 96;
  const COL_AAA = 96;
  const COL_UI = 120;

  // Build one row (horizontal auto-layout). `cells` is an array of nodes for
  // the fixed-width columns; `nameNode` fills the remaining space on the left.
  const addRow = (nameNode, aaNode, aaaNode, uiNode, isHeader) => {
    const row = figma.createFrame();
    row.name = isHeader ? 'Header Row' : 'Row';
    row.layoutMode = 'HORIZONTAL';
    row.counterAxisAlignItems = 'CENTER';
    row.itemSpacing = 12;
    row.paddingLeft = 20;
    row.paddingRight = 20;
    row.paddingTop = isHeader ? 12 : 14;
    row.paddingBottom = isHeader ? 12 : 14;
    row.fills = isHeader ? solidPaint(C.naBg) : solidPaint(C.card);
    // Bottom divider line.
    row.strokes = solidPaint(C.line);
    row.strokeAlign = 'INSIDE';
    row.strokeWeight = 0;
    row.strokeBottomWeight = 1;
    table.appendChild(row);
    row.layoutSizingHorizontal = 'FILL';
    row.layoutSizingVertical = 'HUG';

    // Name cell fills remaining width.
    row.appendChild(nameNode);
    nameNode.layoutSizingHorizontal = 'FILL';
    if ('layoutSizingVertical' in nameNode) nameNode.layoutSizingVertical = 'HUG';

    for (const [node, width] of [[aaNode, COL_AA], [aaaNode, COL_AAA], [uiNode, COL_UI]]) {
      // Wrap each fixed column in a HUG container so badges align left.
      const cell = figma.createFrame();
      cell.layoutMode = 'HORIZONTAL';
      cell.counterAxisSizingMode = 'AUTO';
      cell.primaryAxisSizingMode = 'FIXED';
      cell.fills = [];
      cell.appendChild(node);
      row.appendChild(cell);
      cell.resize(width, cell.height);
      cell.layoutSizingHorizontal = 'FIXED';
      cell.layoutSizingVertical = 'HUG';
    }
    return row;
  };

  // Header row.
  addRow(
    makeText('Frame', { font: FONT.semibold, size: 12, color: C.sub }),
    makeText('Text AA', { font: FONT.semibold, size: 12, color: C.sub }),
    makeText('Text AAA', { font: FONT.semibold, size: 12, color: C.sub }),
    makeText('Non-text 3:1', { font: FONT.semibold, size: 12, color: C.sub }),
    true
  );

  // Data rows.
  for (const r of results) {
    // Name cell: a clickable title (jumps to the frame) + the node address.
    const nameCell = figma.createFrame();
    nameCell.name = 'Name Cell';
    nameCell.layoutMode = 'VERTICAL';
    nameCell.itemSpacing = 2;
    nameCell.fills = [];

    const title = makeText(r.name, { font: FONT.medium, size: 14, color: C.linkInk });
    // Link the whole title to the audited frame. NODE targets must be a
    // page or frame — these are top-level frames, so this is valid.
    try {
      title.setRangeHyperlink(0, title.characters.length, { type: 'NODE', value: r.id });
    } catch (e) {
      /* if linking is unavailable, the id text below is still the address */
    }
    nameCell.appendChild(title);

    const ratioBits = [];
    if (r.minTextRatio != null) ratioBits.push(`min text ${round2(r.minTextRatio)}:1`);
    if (r.uiMinRatio != null) ratioBits.push(`min UI ${round2(r.uiMinRatio)}:1`);
    if (r.textSkipped) ratioBits.push(`${r.textSkipped} run(s) not scored`);
    const meta = `${r.id}${ratioBits.length ? '   •   ' + ratioBits.join('   •   ') : ''}`;
    nameCell.appendChild(makeText(meta, { size: 11, color: C.muted }));

    addRow(
      nameCell,
      makeBadge(badgeKind(r.passAA)),
      makeBadge(badgeKind(r.passAAA)),
      makeBadge(badgeKind(r.passNonText)),
      false
    );
  }

  // Empty-state message if there were no frames to audit.
  if (results.length === 0) {
    const empty = figma.createFrame();
    empty.layoutMode = 'HORIZONTAL';
    empty.paddingLeft = 20;
    empty.paddingRight = 20;
    empty.paddingTop = 18;
    empty.paddingBottom = 18;
    empty.fills = solidPaint(C.card);
    table.appendChild(empty);
    empty.layoutSizingHorizontal = 'FILL';
    empty.layoutSizingVertical = 'HUG';
    empty.appendChild(
      makeText('No top-level frames found on this page to audit.', {
        size: 14,
        color: C.sub,
      })
    );
  }

  // -- Footer --------------------------------------------------------------
  const footer = makeText(
    'Generated by the accessibility-contrast-audit skill. Non-text results are a heuristic for review; verify flagged borders/icons manually. This report does not modify your designs.',
    { size: 11, color: C.muted, lineHeightPct: 150 }
  );
  root.appendChild(footer);
  footer.layoutSizingHorizontal = 'FILL';

  figma.commitUndo();

  if (switchToReport) {
    await figma.setCurrentPageAsync(reportPage);
  }

  // Toast (works in the standalone plugin; harmless if unavailable in use_figma).
  try {
    figma.notify(
      `Contrast audit complete: ${aaFails}/${totalFrames} frame(s) fail AA. Report page created.`
    );
  } catch (e) {
    /* figma.notify is not available in some script hosts — ignore */
  }

  // =========================================================================
  // 8. SUMMARY (returned to the caller)
  // =========================================================================
  return {
    sourcePage: sourcePage.name,
    reportPageId: reportPage.id,
    reportPageName: reportPage.name,
    framesAudited: totalFrames,
    framesFailingAA: aaFails,
    framesFailingAAA: aaaFails,
    results: results.map((r) => ({
      frame: r.name,
      id: r.id,
      passAA: r.passAA,
      passAAA: r.passAAA,
      passNonText: r.passNonText,
      minTextRatio: r.minTextRatio == null ? null : round2(r.minTextRatio),
      worst: r.worst,
    })),
  };
}

// --- EDIT HERE to change behaviour -----------------------------------------
const OPTIONS = {
  includeNonText: true,  // false = skip the UI/non-text (1.4.11) checks
  switchToReport: true,  // false = build the report but stay on the current page
};
// ---------------------------------------------------------------------------

(async () => {
  try {
    const result = await runContrastAudit(OPTIONS);
    console.log("Accessibility Contrast Audit:", result);
  } catch (e) {
    figma.notify("Contrast audit failed: " + (e && e.message ? e.message : e));
    console.error(e);
  } finally {
    figma.closePlugin();
  }
})();
