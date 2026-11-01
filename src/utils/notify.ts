import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

/** 标记「本次已经通知过」，workflow 里的兜底通知据此避免重复推送。 */
const NOTIFIED_FLAG = '/tmp/dailysync_notified';

export const isTelegramConfigured = (): boolean =>
    Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

/**
 * 推送到 Telegram。任何失败都只打日志，绝不影响同步本身。
 * 返回是否真的送达，方便调用方决定要不要再兜底。
 */
export const notifyTelegram = async (text: string): Promise<boolean> => {
    if (!isTelegramConfigured()) {
        console.log('telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), skip notify');
        return false;
    }
    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: TELEGRAM_CHAT_ID,
                text,
                disable_web_page_preview: true,
            },
            { timeout: 10000 },
        );
        console.log('telegram notified');
        try {
            require('fs').writeFileSync(NOTIFIED_FLAG, '1');
        } catch {
            // 标记写不进去不影响通知本身
        }
        return true;
    } catch (error: any) {
        console.log(`telegram notify failed: ${error?.message ?? error}`);
        return false;
    }
};
