import { decryptSecret } from "./security";

const GSM_BASIC = new Set([
  ...`@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ`,
  ...` !"#¤%&'()*+,-./0123456789:;<=>?`,
  ...`¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà`,
]);
const GSM_EXTENSION = new Set([...`^{}\\[~]|€`]);

export function countGsm7(content: string) {
  let characters = 0;
  const unsupported: string[] = [];
  for (const char of content) {
    if (GSM_BASIC.has(char)) characters += 1;
    else if (GSM_EXTENSION.has(char)) characters += 2;
    else unsupported.push(char);
  }
  const segments = characters === 0 ? 0 : characters <= 160 ? 1 : Math.ceil(characters / 153);
  return { characters, segments, unsupported: [...new Set(unsupported)] };
}

export function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function providerCredentials(config: { apiKeyEncrypted: string | null; partnerIdEncrypted: string | null }) {
  if (!config.apiKeyEncrypted || !config.partnerIdEncrypted) throw new Error("SMS gateway credentials are incomplete");
  return {
    apikey: decryptSecret(config.apiKeyEncrypted),
    partnerID: decryptSecret(config.partnerIdEncrypted),
  };
}

export function parseProviderResponse(payload: any) {
  const item = Array.isArray(payload?.responses) ? payload.responses[0] ?? payload : payload;
  const responseCode = String(item?.["response-code"] ?? item?.responseCode ?? item?.code ?? "");
  const responseDescription = String(item?.["response-description"] ?? item?.responseDescription ?? item?.description ?? "");
  const providerMessageId = item?.messageid ?? item?.messageId ?? item?.message_id ?? null;
  const networkId = item?.networkid ?? item?.networkId ?? item?.network_id ?? null;
  const mobile = item?.mobile ?? null;
  return {
    success: responseCode === "200" || responseCode === "0" || /^success$/i.test(responseDescription),
    responseCode,
    responseDescription,
    providerMessageId: providerMessageId === null ? null : String(providerMessageId),
    networkId: networkId === null ? null : String(networkId),
    mobile: mobile === null ? null : String(mobile),
  };
}

export function parseDeliveryStatus(payload: any) {
  const item = Array.isArray(payload?.responses) ? payload.responses[0] ?? payload : payload;
  const providerMessageId = item?.messageid ?? item?.messageID ?? item?.messageId ?? item?.["message-id"] ?? item?.message_id ?? item?.id ?? null;
  const description = String(item?.["delivery-description"] ?? item?.description ?? item?.["response-description"] ?? item?.responseDescription ?? "");
  const rawStatus = String(item?.status ?? item?.deliveryStatus ?? item?.["delivery-status"] ?? item?.statusCode ?? description).toLowerCase();
  const responseCode = String(item?.["response-code"] ?? item?.responseCode ?? item?.code ?? "");
  const delivered = rawStatus.includes("delivered") || rawStatus === "32" || rawStatus === "success" || rawStatus === "0";
  const failed = rawStatus.includes("fail") || rawStatus.includes("reject") || rawStatus.includes("expire") || rawStatus.includes("undeliver");
  return {
    providerMessageId: providerMessageId === null ? null : String(providerMessageId),
    status: delivered ? "delivered" : failed ? "failed" : "sent",
    responseCode,
    responseDescription: description || rawStatus,
  };
}
