/**
 * Rename Layers by Content — standalone Figma plugin (no build step).
 * ---------------------------------------------------------------------------
 * Runs on the CURRENT PAGE. Renames every frame and its generic-named children
 * based on their design content (most prominent text > component > image fill),
 * in readable Title Case. Intentional names are preserved by default. Renames
 * are applied in batches so each batch is a single undo step.
 *
 * To change behaviour, edit the OPTIONS object at the very bottom of this file.
 * This is the same logic as ../rename-layers.js, inlined so it runs as-is.
 * ---------------------------------------------------------------------------
 */

async function renameLayersOnCurrentPage(options) {
  const {
    batchSize = 100,
    overwriteNamed = false,
    maxNameLength = 32,
    descendIntoFrames = true,
  } = options || {};

  figma.skipInvisibleInstanceChildren = true;

  const page = figma.currentPage;

  const GENERIC = /^(frame|group|section|component(\s+set)?|instance|rectangle|ellipse|polygon|star|vector|line|arrow|text|image|slice|boolean(\s+group)?|union|subtract|intersect|exclude)(\s+\d+)?$/i;

  const isGeneric = (name) => GENERIC.test((name || '').trim());

  const clean = (str) =>
    (str || '')
      .replace(/[ -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const toTitleCase = (str) =>
    clean(str)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) =>
        w.length <= 3 && w === w.toUpperCase()
          ? w
          : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      )
      .join(' ');

  const truncate = (str, n) => {
    const s = clean(str);
    return s.length > n ? s.slice(0, n).trim() + '…' : s;
  };

  const hasImageFill = (node) => {
    const fills = node.fills;
    return (
      Array.isArray(fills) &&
      fills.some((p) => p && p.type === 'IMAGE' && p.visible !== false)
    );
  };

  const prominentText = (container) => {
    if (typeof container.findAllWithCriteria !== 'function') return null;
    const texts = container.findAllWithCriteria({ types: ['TEXT'] });
    let best = null;
    let bestSize = -1;
    for (const t of texts) {
      const chars = clean(t.characters);
      if (!chars) continue;
      const size = typeof t.fontSize === 'number' ? t.fontSize : 0;
      if (size > bestSize) {
        best = chars;
        bestSize = size;
      }
    }
    return best;
  };

  const deriveName = async (node) => {
    switch (node.type) {
      case 'TEXT': {
        const c = clean(node.characters);
        return c ? toTitleCase(truncate(c, maxNameLength)) : null;
      }
      case 'INSTANCE': {
        try {
          const mc = await node.getMainComponentAsync();
          if (mc && mc.name) return toTitleCase(truncate(mc.name, maxNameLength));
        } catch (e) {
          /* remote/soft-deleted component */
        }
        return isGeneric(node.name) ? null : toTitleCase(node.name);
      }
      case 'COMPONENT':
      case 'COMPONENT_SET':
        return isGeneric(node.name) ? null : toTitleCase(node.name);
      case 'FRAME':
      case 'GROUP':
      case 'SECTION': {
        const text = prominentText(node);
        if (text) return toTitleCase(truncate(text, maxNameLength));
        if (typeof node.findAllWithCriteria === 'function') {
          const inst = node.findAllWithCriteria({ types: ['INSTANCE'] })[0];
          if (inst) {
            let cname = null;
            try {
              const mc = await inst.getMainComponentAsync();
              if (mc && mc.name) cname = mc.name;
            } catch (e) {
              /* remote/soft-deleted component */
            }
            if (!cname && inst.name && !isGeneric(inst.name)) cname = inst.name;
            if (cname) return toTitleCase(truncate(cname, maxNameLength)) + ' Group';
          }
        }
        if (hasImageFill(node)) return 'Image';
        return null;
      }
      case 'RECTANGLE':
      case 'ELLIPSE':
      case 'POLYGON':
      case 'STAR':
        return hasImageFill(node) ? 'Image' : null;
      default:
        return null;
    }
  };

  const targets = [];

  const visit = async (node) => {
    if (overwriteNamed || isGeneric(node.name)) {
      const proposed = await deriveName(node);
      if (proposed && proposed !== node.name) {
        targets.push({ node, newName: proposed });
      }
    }
    if (descendIntoFrames && 'children' in node && node.type !== 'INSTANCE') {
      for (const child of node.children) {
        await visit(child);
      }
    }
  };

  for (const top of page.children) {
    await visit(top);
  }

  let renamed = 0;
  for (let i = 0; i < targets.length; i++) {
    const { node, newName } = targets[i];
    try {
      node.name = newName;
      renamed++;
    } catch (e) {
      /* locked/restricted node */
    }
    if ((i + 1) % batchSize === 0) {
      figma.commitUndo();
    }
  }
  figma.commitUndo();

  figma.notify(
    `Renamed ${renamed} of ${targets.length} layer(s) on “${page.name}”.`
  );
  return { renamed, candidates: targets.length, page: page.name };
}

// --- EDIT HERE to change behaviour -----------------------------------------
const OPTIONS = {
  batchSize: 100,        // how many layers are renamed per undo step
  overwriteNamed: false, // true = rename even layers you named yourself
};
// ---------------------------------------------------------------------------

(async () => {
  try {
    const result = await renameLayersOnCurrentPage(OPTIONS);
    console.log('Rename Layers by Content:', result);
  } catch (e) {
    figma.notify('Rename failed: ' + (e && e.message ? e.message : e));
    console.error(e);
  } finally {
    figma.closePlugin();
  }
})();
