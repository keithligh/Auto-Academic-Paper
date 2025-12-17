/**
 * Citation Engine for LaTeX Preview
 * 
 * EXTRACTED FROM: LatexPreview.tsx
 * SCOPE: IEEE Citation parsing, grouping, and Bibliography generation.
 */

export interface CitationResult {
    sanitized: string;
    bibliographyHtml: string | null;
}

export function processCitations(latex: string): CitationResult {
    let content = latex;
    const citationMap = new Map<string, number>();
    let nextCitationId = 1;
    const references: string[] = [];

    // Helper: IEEE Style Grouping
    const formatCitations = (keys: string): string => {
        const keyList = keys.split(',').map((k: string) => k.trim());
        const ids: number[] = [];

        keyList.forEach((key: string) => {
            // Normalize: remove escaped underscores
            const normalizedKey = key.replace(/\\_/g, '_');

            if (!citationMap.has(normalizedKey)) {
                // FIX (v1.9.5): Respect explicit ref numbers (e.g. ref_5 -> [5])
                const match = normalizedKey.match(/^ref_(\d+)$/i);
                let id = nextCitationId;

                if (match) {
                    id = parseInt(match[1], 10);
                    // Update nextCitationId to avoid collisions if we're jumping ahead
                    if (id >= nextCitationId) nextCitationId = id + 1;
                } else {
                    nextCitationId++;
                }

                citationMap.set(normalizedKey, id);
                references.push(normalizedKey);
            }
            ids.push(citationMap.get(normalizedKey)!);
        });

        // Sort ids for grouping
        ids.sort((a, b) => a - b);

        const ranges: string[] = [];
        if (ids.length === 0) return '';

        let start = ids[0];
        let end = ids[0];

        for (let i = 1; i < ids.length; i++) {
            if (ids[i] === end + 1) {
                end = ids[i];
            } else {
                ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);
                start = ids[i];
                end = ids[i];
            }
        }
        ranges.push(start === end ? `[${start}]` : `[${start}]–[${end}]`);
        return ranges.join(', ');
    };

    // 1. Handle \cite{ref_1,ref_2,...}
    content = content.replace(/\\cite\{([^}]+)\}/g, (match, keys) => formatCitations(keys));

    // 2. Handle consecutive (ref_x)(ref_y) -> combine
    content = content.replace(/(\(ref_?\d+\))+/gi, (match) => {
        const allRefs = match.match(/ref_?\d+/gi);
        if (allRefs) {
            return formatCitations(allRefs.join(','));
        }
        return match;
    });

    // 2b. Handle comma-separated list inside parentheses: (ref_1, ref_5)
    content = content.replace(/\(\s*((?:ref\\?_?\d+)(?:\s*,\s*ref\\?_?\d+)*)\s*\)/gi, (match, inner) => {
        return formatCitations(inner);
    });

    // 4. Handle single (ref_x) or (ref\_x)
    content = content.replace(/\(\s*ref\\?_?(\d+)\s*\)/gi, (match, num) => formatCitations(`ref_${num}`));

    // 4b. Handle direct \ref{ref_X} hallucinations
    content = content.replace(/\\ref\{ref_(\d+)\}/gi, (match, num) => formatCitations(`ref_${num}`));

    // Generate Bibliography HTML if references exist
    let bibliographyHtml: string | null = null;
    const hasManualBibliography = /\\begin\{thebibliography\}/.test(latex); // Simple check

    if (references.length > 0 && !hasManualBibliography) {
        let bibItemsHtml = '<ul style="list-style: none; padding: 0;">';
        references.forEach((refKey, index) => {
            // We re-derive the ID if needed, but since 'references' pushes in order of discovery (mostly),
            // we might want the ACTUAL ID from the map to be perfectly safe?
            // Actually, references array order matches the discovery order (1, 2, 3...) ONLY if no explicit ref_5 jumps.
            // Let's use the citationMap id for the label.
            const id = citationMap.get(refKey);
            bibItemsHtml += `<li style="margin-bottom: 0.5em;"> [${id}] <span style="margin-left: 0.5em;"> ${refKey.replace(/_/g, ' ')}</span></li> `;
        });
        bibItemsHtml += '</ul>';

        bibliographyHtml = `
      <div class="bibliography" style="margin-top: 4em; border-top: 1px solid #ccc; padding-top: 1em;">
        <h2>References</h2>
        ${bibItemsHtml}
      </div>
    `;
    }

    return { sanitized: content, bibliographyHtml };
}
