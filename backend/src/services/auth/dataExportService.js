import prisma from '../../config/prisma.js';

/**
 * Everything the platform holds about one user, assembled for that user.
 *
 * This exists for GDPR Art. 15 (access) and Art. 20 (portability), and CCPA's equivalent
 * right to know. There was no way to answer either request short of someone running SQL by
 * hand, which is not a process that survives contact with a deadline.
 *
 * Two rules govern what goes in:
 *
 *  1. Secrets are described, never disclosed. A user is entitled to know that they have a
 *     stored OpenAI key, when it was added and which models it can reach — they are not
 *     entitled to have the ciphertext handed back, and neither is anyone who gets hold of
 *     the export file. Encrypted OAuth tokens, provider-key ciphertext and API-key hashes
 *     are represented by their existence and metadata only. Note that these are the user's
 *     *own* credentials: the risk being managed is the export file itself becoming a
 *     credential store that outlives the account.
 *
 *  2. It is the user's own data, so the free-text they authored — analysis input, chat
 *     messages, generated documents — is included in full. Redacting that would defeat the
 *     purpose of a portability export.
 */
export async function exportUserData(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, image: true, createdAt: true }
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    const [projects, analyses, sessions, accounts, apiKeys, providerKeys] = await Promise.all([
        prisma.project.findMany({
            where: { userId },
            select: { id: true, name: true, description: true, settings: true, createdAt: true, updatedAt: true }
        }),
        prisma.analysis.findMany({
            where: { userId },
            select: {
                id: true, title: true, inputText: true, resultJson: true, metadata: true,
                status: true, version: true, rootId: true, parentId: true, projectId: true,
                isFinalized: true, createdAt: true, updatedAt: true
            },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.session.findMany({
            where: { userId },
            // `token` is the live refresh credential for that session — the one field in this
            // table that must not travel.
            select: { id: true, userAgent: true, ipAddress: true, location: true, createdAt: true, lastUsedAt: true, expiresAt: true }
        }),
        prisma.account.findMany({
            where: { userId },
            select: { id: true, provider: true, providerAccountId: true }
        }),
        prisma.apiKey.findMany({
            where: { userId },
            select: { id: true, name: true, createdAt: true, lastUsed: true, expiresAt: true }
        }),
        prisma.userProviderKey.findMany({
            where: { userId },
            select: { id: true, provider: true, maskedKey: true, label: true, isActive: true, createdAt: true, updatedAt: true }
        })
    ]);

    const analysisIds = analyses.map(a => a.id);
    const chatMessages = analysisIds.length > 0
        ? await prisma.chatMessage.findMany({
            where: { analysisId: { in: analysisIds } },
            select: { id: true, analysisId: true, role: true, content: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        })
        : [];

    return {
        exportedAt: new Date().toISOString(),
        format: 'sra-user-export/v1',
        notice: 'Credentials are represented by metadata only. Stored API keys, OAuth tokens and refresh tokens are deliberately excluded.',
        user,
        projects,
        analyses,
        chatMessages,
        sessions,
        linkedAccounts: accounts,
        apiKeys,
        providerKeys
    };
}
