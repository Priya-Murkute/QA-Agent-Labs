const CHARS_PER_TOKEN = 4; // rough heuristic — good enough for staying under a rate limit, not exact

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitByParagraphs(text: string, maxTokens: number): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let current = '';

    for (const paragraph of paragraphs) {
        const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
        if (estimateTokens(candidate) > maxTokens && current) {
            chunks.push(current);
            current = paragraph;
        } else {
            current = candidate;
        }

        // last resort: a single paragraph alone is bigger than the budget — hard-split it
        const maxChars = maxTokens * CHARS_PER_TOKEN;
        while (estimateTokens(current) > maxTokens) {
            chunks.push(current.slice(0, maxChars));
            current = current.slice(maxChars);
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

export function chunkDocument(text: string, maxTokensPerChunk: number): string[] {
    if (estimateTokens(text) <= maxTokensPerChunk) {
        return [text];
    }

    // Prefer splitting on markdown headings when the doc has them — keeps related content together
    const sections = text.split(/\n(?=#{1,3}\s)/);
    if (sections.length > 1) {
        const chunks: string[] = [];
        let current = '';
        for (const section of sections) {
            const candidate = current ? `${current}\n${section}` : section;
            if (estimateTokens(candidate) > maxTokensPerChunk && current) {
                chunks.push(current);
                current = section;
            } else {
                current = candidate;
            }
        }
        if (current) chunks.push(current);

        return chunks.flatMap(chunk =>
            estimateTokens(chunk) > maxTokensPerChunk
                ? splitByParagraphs(chunk, maxTokensPerChunk)
                : [chunk]
        );
    }

    // No headings at all — fall back to paragraph splitting
    return splitByParagraphs(text, maxTokensPerChunk);
}
