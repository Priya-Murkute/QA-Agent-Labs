export async function withRetry<T>(
    fn: () => Promise<T>,
    options: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
    const { retries = 3, baseDelayMs = 2000 } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            const isRateLimit = error?.status === 429;
            const isLastAttempt = attempt === retries;

            if (!isRateLimit || isLastAttempt) {
                throw error;
            }

            const delay = baseDelayMs * 2 ** attempt; // 2s, 4s, 8s...
            console.warn(`  Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error('Retry loop exited unexpectedly');
}
