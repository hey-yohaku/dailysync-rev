import { getGaminCNClient, syncGarminCNActivities2GarminGlobal } from './utils/garmin_cn';
import { getGaminGlobalClient } from './utils/garmin_global';
import { getSessionFromDB, initDB, saveSessionToDB, updateSessionToDB } from './utils/sqlite';

const core = require('@actions/core');

/**
 * 把客户端里“跑完之后”的 token 写回 db。
 *
 * 必须放在同步之后：@gooin/garmin-connect 只在请求时按需 refresh，
 * refresh 之后 oauth2Token 会被替换成新的 access_token + refresh_token，
 * refresh_token_expires_at 也顺延。如果只像 getGaminCNClient 那样在 loadToken
 * 之后立刻保存，存下去的还是旧 token，30 天窗口不会滚动。
 */
const persistSession = async (region: 'CN' | 'GLOBAL', client: any) => {
    if (!client) {
        return;
    }
    try {
        const token = client.exportToken();
        if (!token?.oauth1 || !token?.oauth2) {
            return;
        }
        if (await getSessionFromDB(region)) {
            await updateSessionToDB(region, token);
        } else {
            await saveSessionToDB(region, token);
        }
        const refreshExpiresAt = token.oauth2.refresh_token_expires_at;
        const when = refreshExpiresAt ? new Date(refreshExpiresAt * 1000).toISOString().slice(0, 10) : 'n/a';
        console.log(`session ${region} persisted (refresh token valid until ${when})`);
    } catch (error: any) {
        console.log(`session ${region} persist failed: ${error?.message ?? error}`);
    }
};

const main = async () => {
    await initDB();
    const clientCN = await getGaminCNClient();
    const clientGlobal = await getGaminGlobalClient();

    try {
        await syncGarminCNActivities2GarminGlobal(clientCN, clientGlobal);
    } finally {
        // 失败也要保存：refresh 可能已经发生，丢掉就等于白白消耗了一次轮换
        await persistSession('CN', clientCN);
        await persistSession('GLOBAL', clientGlobal);
    }
};

main().catch((error) => {
    core.setFailed(error?.message ?? String(error));
    process.exit(1);
});
