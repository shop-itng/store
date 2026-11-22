// Self-contained ESM bundle built by scripts/build-api.mjs from server/app.ts

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/config/minorSafety.ts
function isMinorAccount(input) {
  if (input.sellerUnder18) return true;
  if (input.age !== null && input.age !== void 0 && String(input.age).trim() !== "") {
    const parsed = Number(input.age);
    if (Number.isFinite(parsed) && parsed < ADULT_AGE_THRESHOLD) {
      return true;
    }
  }
  return false;
}
function isAdultAccount(age) {
  if (age === null || age === void 0 || String(age).trim() === "") {
    return true;
  }
  const parsed = Number(age);
  if (!Number.isFinite(parsed)) return true;
  return parsed >= ADULT_AGE_THRESHOLD;
}
function evaluateMinorFollowRule(params) {
  const viewerUnder18 = params.viewerIsUnder18 ?? isMinorAccount({ age: params.viewerAge });
  if (!params.targetIsUnder18) {
    if (MINOR_SAFETY_RULES.blockMinorFollowingAdults && viewerUnder18) {
      return {
        allowed: false,
        reason: "For youth safety, under-18 accounts cannot follow adult accounts."
      };
    }
    return { allowed: true };
  }
  if (MINOR_SAFETY_RULES.blockAdultFollowingMinors && !viewerUnder18 && isAdultAccount(params.viewerAge)) {
    return {
      allowed: false,
      reason: "For youth safety, adults cannot follow or send follow requests to under-18 accounts."
    };
  }
  return {
    allowed: true,
    forcedStatus: MINOR_SAFETY_RULES.forceMinorFollowApproval ? "pending" : void 0
  };
}
function evaluateMinorChatStart(params) {
  if (params.isAdmin) return { allowed: true };
  const involvesMinor = params.sellerIsUnder18 || params.buyerIsUnder18;
  if (!involvesMinor) return { allowed: true };
  if (MINOR_SAFETY_RULES.requireProductOrOrderForMinorChat && !params.hasVerifiedProduct && !params.hasVerifiedOrder) {
    return {
      allowed: false,
      reason: "For under-18 safety, chats involving under-18 accounts must be linked to a real product listing or order."
    };
  }
  return { allowed: true };
}
function evaluateMinorMessageSend(params) {
  if (params.isAdmin) return { allowed: true };
  const involvesMinor = params.sellerIsUnder18 || params.buyerIsUnder18;
  if (!involvesMinor) return { allowed: true };
  if (MINOR_SAFETY_RULES.requireProductOrOrderForMinorChat && !params.conversationProductId && !params.conversationOrderId) {
    return {
      allowed: false,
      reason: "For under-18 safety, private chat without a real product or order is not allowed."
    };
  }
  return { allowed: true };
}
var MINIMUM_PLATFORM_AGE, ADULT_AGE_THRESHOLD, MINOR_SAFETY_RULES;
var init_minorSafety = __esm({
  "server/config/minorSafety.ts"() {
    MINIMUM_PLATFORM_AGE = 10;
    ADULT_AGE_THRESHOLD = 18;
    MINOR_SAFETY_RULES = {
      /** Adults (18+) are blocked from following or sending follow requests to under-18 accounts. */
      blockAdultFollowingMinors: true,
      /** Under-18 accounts are also blocked from following adult (18+) accounts. */
      blockMinorFollowingAdults: true,
      /** Under-18 accounts must manually approve incoming follow requests (from peers under 18). */
      forceMinorFollowApproval: true,
      /** Exclude under-18 accounts from user search (/profiles/search) and suggested makers (/profiles/discover/suggested). */
      hideMinorsFromSearchAndDiscovery: true,
      /** Keep minor makers' public shop storefronts & craft listings accessible so customers can browse and buy. */
      keepMinorShopsAndProductsPublic: true,
      /** Keep privacy settings locked so minors cannot weaken protections. */
      lockedPrivacySettings: {
        profileVisibility: "public",
        whoCanFollow: "approval",
        whoCanMessage: "mutual",
        showFollowersList: false,
        showFollowingList: false,
        showLastSeen: false
      },
      /**
       * Minors cannot have open free private messaging (`whoCanMessage` locked to `'mutual'`).
       * However, buyers CAN message a minor maker about a real DB-verified product listing or order.
       * No real product or order => no message allowed.
       */
      allowProductOrOrderLinkedChat: true,
      requireProductOrOrderForMinorChat: true
    };
    __name(isMinorAccount, "isMinorAccount");
    __name(isAdultAccount, "isAdultAccount");
    __name(evaluateMinorFollowRule, "evaluateMinorFollowRule");
    __name(evaluateMinorChatStart, "evaluateMinorChatStart");
    __name(evaluateMinorMessageSend, "evaluateMinorMessageSend");
  }
});

// shared/profileOptions.ts
var PROFILE_INTERESTS, ALLOWED_LANGUAGES, PROCESSING_TIME_OPTIONS, DEFAULT_AVATAR_PRESETS, MAX_TAGLINE_LENGTH, MAX_BIO_LENGTH, MAX_SHOP_STORY_LENGTH, MAX_CRAFT_MATERIALS_LENGTH;
var init_profileOptions = __esm({
  "shared/profileOptions.ts"() {
    PROFILE_INTERESTS = [
      "Waist Beads & Jewelry",
      "Crochet & Yarn",
      "Perfume Oils & Scents",
      "Thrift & Fashion",
      "Room Decor & Candles",
      "Art & Illustration",
      "Phone Cases & Tech Crafts",
      "Hair Accessories",
      "Leather & Bags",
      "Stationery & Gifts"
    ];
    ALLOWED_LANGUAGES = [
      "English",
      "Nigerian Pidgin",
      "Yoruba",
      "Igbo",
      "Hausa",
      "Ibibio",
      "Efik",
      "Tiv",
      "Fulfulde",
      "French"
    ];
    PROCESSING_TIME_OPTIONS = [
      "Same day",
      "1\u20132 days",
      "1\u20133 days",
      "3\u20135 days",
      "1\u20132 weeks",
      "Made to order (custom timeline)"
    ];
    DEFAULT_AVATAR_PRESETS = [
      { id: "avatar-1", label: "Warm Sunset", url: "/avatars/avatar-1.svg" },
      { id: "avatar-2", label: "Fresh Leaf", url: "/avatars/avatar-2.svg" },
      { id: "avatar-3", label: "Midnight Star", url: "/avatars/avatar-3.svg" },
      { id: "avatar-4", label: "Amber Wave", url: "/avatars/avatar-4.svg" },
      { id: "avatar-5", label: "Emerald Shield", url: "/avatars/avatar-5.svg" },
      { id: "avatar-6", label: "Terracotta Bead", url: "/avatars/avatar-6.svg" }
    ];
    MAX_TAGLINE_LENGTH = 80;
    MAX_BIO_LENGTH = 300;
    MAX_SHOP_STORY_LENGTH = 600;
    MAX_CRAFT_MATERIALS_LENGTH = 300;
  }
});

// server/lib/validation.ts
var validation_exports = {};
__export(validation_exports, {
  ALLOWED_AVATAR_PRESETS: () => ALLOWED_AVATAR_PRESETS,
  ALLOWED_LANGUAGES: () => ALLOWED_LANGUAGES,
  ALLOWED_UPLOAD_PURPOSES: () => ALLOWED_UPLOAD_PURPOSES,
  DEFAULT_AVATAR_PRESETS: () => DEFAULT_AVATAR_PRESETS,
  DEFAULT_NOTIFICATION_PREFS: () => DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY_SETTINGS: () => DEFAULT_PRIVACY_SETTINGS,
  MAX_BIO_LENGTH: () => MAX_BIO_LENGTH,
  MAX_CRAFT_MATERIALS_LENGTH: () => MAX_CRAFT_MATERIALS_LENGTH,
  MAX_SHOP_STORY_LENGTH: () => MAX_SHOP_STORY_LENGTH,
  MAX_TAGLINE_LENGTH: () => MAX_TAGLINE_LENGTH,
  PROCESSING_TIME_OPTIONS: () => PROCESSING_TIME_OPTIONS,
  PROFILE_INTERESTS: () => PROFILE_INTERESTS,
  UNDER_18_PRIVACY_SETTINGS: () => UNDER_18_PRIVACY_SETTINGS,
  containsForbiddenContactInfo: () => containsForbiddenContactInfo,
  extractFirstName: () => extractFirstName,
  generateUniqueProfileSlug: () => generateUniqueProfileSlug,
  rejectUnknownFields: () => rejectUnknownFields,
  sanitizeDeliveryOptions: () => sanitizeDeliveryOptions,
  sanitizeNotificationPrefs: () => sanitizeNotificationPrefs,
  sanitizePrivacySettings: () => sanitizePrivacySettings,
  slugifyDisplayName: () => slugifyDisplayName,
  stripJpegMetadata: () => stripJpegMetadata,
  validateAndSanitizeImageInput: () => validateAndSanitizeImageInput,
  validateAndSanitizeUploadFile: () => validateAndSanitizeUploadFile
});
import crypto from "crypto";
function rejectUnknownFields(body, allowedKeys) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Request body must be a valid JSON object." };
  }
  const obj = body;
  const unknown = Object.keys(obj).filter((k) => !allowedKeys.includes(k));
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unexpected field(s): ${unknown.slice(0, 5).join(", ")}.`
    };
  }
  return { ok: true, obj };
}
function containsForbiddenContactInfo(text) {
  if (!text) return { blocked: false };
  const normalized = text.replace(/\u200B/g, "");
  if (EMAIL_REGEX.test(normalized)) {
    return { blocked: true, reason: "Email addresses are not allowed in public text fields." };
  }
  if (PHONE_REGEX.test(normalized)) {
    return { blocked: true, reason: "Phone numbers or long digit sequences are not allowed for safety." };
  }
  if (URL_REGEX.test(normalized)) {
    return { blocked: true, reason: "External website links are not allowed." };
  }
  if (HANDLE_OR_OFFPLATFORM_REGEX.test(normalized)) {
    return { blocked: true, reason: "Social handles or off-platform contact details are not allowed." };
  }
  return { blocked: false };
}
function extractFirstName(fullName) {
  const cleaned = String(fullName || "").trim().replace(/\s+/g, " ");
  const first = cleaned.split(" ")[0] || "Member";
  const stripped = first.replace(/[^a-zA-Z0-9'-]/g, "").slice(0, 40);
  return stripped.length >= 2 ? stripped : "Member";
}
function slugifyDisplayName(displayName) {
  const base = String(displayName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 45);
  return base || "shopit-member";
}
async function generateUniqueProfileSlug(queryFn, displayName, excludeUserId) {
  const baseSlug = slugifyDisplayName(displayName);
  let candidate = baseSlug;
  let counter = 2;
  while (counter <= 200) {
    const res = excludeUserId ? await queryFn("SELECT id FROM shopit_users WHERE LOWER(profile_slug) = LOWER($1) AND id != $2 LIMIT 1", [
      candidate,
      excludeUserId
    ]) : await queryFn("SELECT id FROM shopit_users WHERE LOWER(profile_slug) = LOWER($1) LIMIT 1", [candidate]);
    let histTaken = false;
    if (res.rows.length === 0) {
      try {
        const histRes = excludeUserId ? await queryFn(
          "SELECT slug FROM shopit_profile_slug_history WHERE LOWER(slug) = LOWER($1) AND user_id != $2 LIMIT 1",
          [candidate, excludeUserId]
        ) : await queryFn("SELECT slug FROM shopit_profile_slug_history WHERE LOWER(slug) = LOWER($1) LIMIT 1", [
          candidate
        ]);
        histTaken = histRes.rows.length > 0;
      } catch {
        histTaken = false;
      }
    }
    if (res.rows.length === 0 && !histTaken) {
      return candidate;
    }
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
  return `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
}
function sanitizeDeliveryOptions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Delivery options must be a valid object." };
  }
  const src = input;
  const allowsPickup = src.allowsPickup !== void 0 ? Boolean(src.allowsPickup) : true;
  const allowsLocalDelivery = src.allowsLocalDelivery !== void 0 ? Boolean(src.allowsLocalDelivery) : true;
  const rawSpots = Array.isArray(src.pickupSpots) ? src.pickupSpots : [];
  const pickupSpots = [];
  for (const item of rawSpots.slice(0, 5)) {
    const spot = String(item || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!spot) continue;
    const contact = containsForbiddenContactInfo(spot);
    if (contact.blocked) {
      return { valid: false, message: `Pickup spot "${spot}": ${contact.reason}` };
    }
    if (!pickupSpots.includes(spot)) {
      pickupSpots.push(spot);
    }
  }
  return {
    valid: true,
    value: {
      allowsPickup,
      allowsLocalDelivery,
      pickupSpots
    }
  };
}
function stripJpegMetadata(buf) {
  if (buf.length < 4 || buf[0] !== 255 || buf[1] !== 216) {
    return null;
  }
  const chunks = [buf.subarray(0, 2)];
  let offset = 2;
  while (offset + 1 < buf.length) {
    if (buf[offset] !== 255) {
      chunks.push(buf.subarray(offset));
      break;
    }
    const marker = buf[offset + 1];
    if (marker === 0 || marker >= 208 && marker <= 217 || marker === 1) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      if (marker === 217) break;
      continue;
    }
    if (marker === 218) {
      chunks.push(buf.subarray(offset));
      break;
    }
    if (offset + 3 >= buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2 || offset + 2 + segLen > buf.length) break;
    const shouldDrop = marker === 225 || marker === 237 || marker === 254;
    if (!shouldDrop) {
      chunks.push(buf.subarray(offset, offset + 2 + segLen));
    }
    offset += 2 + segLen;
  }
  return Buffer.concat(chunks);
}
function verifyMagicBytesForImage(mime, buf) {
  const isJpeg = buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255;
  const isPng = buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10;
  const isWebp = buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  const isGif = buf.length >= 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a");
  if (mime === "image/jpeg") {
    if (!isJpeg) return { ok: false, message: "File content does not match JPEG image signature." };
    const stripped = stripJpegMetadata(buf);
    if (!stripped) return { ok: false, message: "Corrupted JPEG image." };
    return { ok: true, buf: stripped };
  }
  if (mime === "image/png") {
    if (!isPng) return { ok: false, message: "File content does not match PNG image signature." };
    return { ok: true, buf };
  }
  if (mime === "image/webp") {
    if (!isWebp) return { ok: false, message: "File content does not match WebP image signature." };
    return { ok: true, buf };
  }
  if (mime === "image/gif") {
    if (!isGif) return { ok: false, message: "File content does not match GIF image signature." };
    return { ok: true, buf };
  }
  return { ok: false, message: "Unsupported image type." };
}
function validateAndSanitizeImageInput(rawUrl, allowEmpty = true) {
  if (rawUrl === void 0 || rawUrl === null || rawUrl === "") {
    return allowEmpty ? { valid: true, url: null } : { valid: false, message: "Image is required." };
  }
  if (typeof rawUrl !== "string") {
    return { valid: false, message: "Image must be a valid upload path, data URL, or preset path." };
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return allowEmpty ? { valid: true, url: null } : { valid: false, message: "Image is required." };
  }
  if (ALLOWED_AVATAR_PRESETS.includes(trimmed) || trimmed === "/shopit-logo.png") {
    return { valid: true, url: trimmed };
  }
  if (/^\/api\/files\/file_[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: true, url: trimmed };
  }
  if (/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(trimmed)) {
    return { valid: true, url: trimmed };
  }
  const dataMatch = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!dataMatch) {
    return { valid: false, message: "Only JPG, PNG, or WebP images or curated preset avatars are allowed." };
  }
  const mime = dataMatch[1].toLowerCase() === "image/jpg" ? "image/jpeg" : dataMatch[1].toLowerCase();
  const base64Body = dataMatch[2].replace(/\s+/g, "");
  const buf = Buffer.from(base64Body, "base64");
  const MAX_BYTES = 5 * 1024 * 1024;
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { valid: false, message: "Image size must be greater than 0 and under 5 MB." };
  }
  const verified = verifyMagicBytesForImage(mime, buf);
  if (!verified.ok) {
    return { valid: false, message: verified.message };
  }
  return {
    valid: true,
    url: `data:${mime};base64,${verified.buf.toString("base64")}`
  };
}
function validateAndSanitizeUploadFile(params) {
  const { dataUrl, fileName, purpose } = params;
  if (typeof dataUrl !== "string" || !dataUrl.trim()) {
    return { valid: false, message: "File data URL is required." };
  }
  const rawName = String(fileName || "upload").trim();
  const cleanName = rawName.replace(/[\r\n\0/\\]+/g, "_").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "upload";
  const match = /^data:([a-z0-9+.-]+\/[a-z0-9+.-]+)(?:;[a-z0-9=_-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) {
    return { valid: false, message: "Invalid file format. Please upload a JPG, PNG, WebP, GIF, PDF, or TXT file." };
  }
  let mimeType = match[1].toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (mimeType.includes("svg") || mimeType.includes("html") || mimeType.includes("javascript") || mimeType.includes("xml")) {
    return { valid: false, message: "SVG, HTML, and script files are blocked for security." };
  }
  const base64Body = match[2].replace(/\s+/g, "");
  const buf = Buffer.from(base64Body, "base64");
  const MAX_BYTES = 4 * 1024 * 1024;
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { valid: false, message: "File size must be between 1 byte and 4 MB." };
  }
  const isImageMime = mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp" || mimeType === "image/gif";
  if (isImageMime) {
    const verified = verifyMagicBytesForImage(mimeType, buf);
    if (!verified.ok) {
      return { valid: false, message: verified.message };
    }
    const finalBuf = verified.buf;
    const sha256 = crypto.createHash("sha256").update(finalBuf).digest("hex");
    return {
      valid: true,
      mimeType,
      sizeBytes: finalBuf.length,
      base64Data: finalBuf.toString("base64"),
      cleanName,
      kind: "image",
      sha256
    };
  }
  if (purpose === "chat" && (mimeType === "application/pdf" || mimeType === "text/plain")) {
    if (mimeType === "application/pdf") {
      const hasPdfSig = buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
      if (!hasPdfSig) {
        return { valid: false, message: "File content does not match a valid PDF document." };
      }
    } else {
      if (buf.includes(0)) {
        return { valid: false, message: "Binary data is not allowed inside a plain-text file." };
      }
      const txt = buf.toString("utf8");
      if (/<script|<iframe|javascript:/i.test(txt)) {
        return { valid: false, message: "Text attachment contains disallowed script/HTML markup." };
      }
    }
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    return {
      valid: true,
      mimeType,
      sizeBytes: buf.length,
      base64Data: buf.toString("base64"),
      cleanName,
      kind: "document",
      sha256
    };
  }
  return {
    valid: false,
    message: purpose === "chat" ? "Only JPG, PNG, WebP, GIF, PDF, or TXT files are allowed in chat." : "Only JPG, PNG, WebP, or GIF image files are allowed for this upload."
  };
}
function sanitizeNotificationPrefs(input, current = DEFAULT_NOTIFICATION_PREFS) {
  const src = input && typeof input === "object" ? input : {};
  const emailOrdersRaw = src.emailOrders !== void 0 ? src.emailOrders : src.orderUpdates;
  const emailMessagesRaw = src.emailMessages !== void 0 ? src.emailMessages : src.messageReceived;
  const emailFollowersRaw = src.emailFollowers !== void 0 ? src.emailFollowers : src.newFollower;
  const emailRestockRaw = src.emailRestock !== void 0 ? src.emailRestock : src.newProductFromFollowing;
  return {
    emailOrders: emailOrdersRaw !== void 0 ? Boolean(emailOrdersRaw) : current.emailOrders,
    emailMessages: emailMessagesRaw !== void 0 ? Boolean(emailMessagesRaw) : current.emailMessages,
    emailFollowers: emailFollowersRaw !== void 0 ? Boolean(emailFollowersRaw) : current.emailFollowers,
    emailRestock: emailRestockRaw !== void 0 ? Boolean(emailRestockRaw) : current.emailRestock
  };
}
function sanitizePrivacySettings(input, current = DEFAULT_PRIVACY_SETTINGS, isUnder18 = false) {
  const src = input && typeof input === "object" ? input : {};
  let visRaw = src.profileVisibility;
  if (visRaw === "everyone") visRaw = "public";
  const vis = visRaw === "followers" || visRaw === "public" ? visRaw : current.profileVisibility;
  const follow = src.whoCanFollow === "approval" || src.whoCanFollow === "everyone" ? src.whoCanFollow : current.whoCanFollow;
  let msgRaw = src.whoCanMessage;
  if (msgRaw === "order_or_product") msgRaw = "mutual";
  const msg = msgRaw === "everyone" || msgRaw === "followers" || msgRaw === "mutual" ? msgRaw : current.whoCanMessage;
  return {
    profileVisibility: vis,
    whoCanFollow: isUnder18 ? "approval" : follow,
    whoCanMessage: isUnder18 ? "mutual" : msg,
    showFollowersList: src.showFollowersList !== void 0 ? Boolean(src.showFollowersList) : current.showFollowersList,
    showFollowingList: src.showFollowingList !== void 0 ? Boolean(src.showFollowingList) : current.showFollowingList,
    showLastSeen: src.showLastSeen !== void 0 ? Boolean(src.showLastSeen) : current.showLastSeen
  };
}
var ALLOWED_AVATAR_PRESETS, DEFAULT_NOTIFICATION_PREFS, DEFAULT_PRIVACY_SETTINGS, UNDER_18_PRIVACY_SETTINGS, PHONE_REGEX, EMAIL_REGEX, URL_REGEX, HANDLE_OR_OFFPLATFORM_REGEX, ALLOWED_UPLOAD_PURPOSES;
var init_validation = __esm({
  "server/lib/validation.ts"() {
    init_minorSafety();
    init_profileOptions();
    ALLOWED_AVATAR_PRESETS = DEFAULT_AVATAR_PRESETS.map((p) => p.url);
    DEFAULT_NOTIFICATION_PREFS = {
      emailOrders: true,
      emailMessages: true,
      emailFollowers: true,
      emailRestock: true
    };
    DEFAULT_PRIVACY_SETTINGS = {
      profileVisibility: "public",
      whoCanFollow: "everyone",
      whoCanMessage: "everyone",
      showFollowersList: true,
      showFollowingList: true,
      showLastSeen: true
    };
    UNDER_18_PRIVACY_SETTINGS = {
      ...MINOR_SAFETY_RULES.lockedPrivacySettings
    };
    __name(rejectUnknownFields, "rejectUnknownFields");
    PHONE_REGEX = /(\+?234|0)[789][01]\d{8}|(?:\d[\s.-]*){7,}/;
    EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    URL_REGEX = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|ng|net|org|io|me|ly|co|app|dev|xyz|link)(\/|$|\s))/i;
    HANDLE_OR_OFFPLATFORM_REGEX = /(?:^|\s)@[a-z0-9._]{2,}|\b(whatsapp|wa\.me|t\.me|telegram|instagram|insta|ig\s*:|snapchat|tiktok|opay|palmpay|kuda|bank\s*transfer|call\s*me|dm\s*me|text\s*me)\b/i;
    __name(containsForbiddenContactInfo, "containsForbiddenContactInfo");
    __name(extractFirstName, "extractFirstName");
    __name(slugifyDisplayName, "slugifyDisplayName");
    __name(generateUniqueProfileSlug, "generateUniqueProfileSlug");
    __name(sanitizeDeliveryOptions, "sanitizeDeliveryOptions");
    __name(stripJpegMetadata, "stripJpegMetadata");
    __name(verifyMagicBytesForImage, "verifyMagicBytesForImage");
    __name(validateAndSanitizeImageInput, "validateAndSanitizeImageInput");
    ALLOWED_UPLOAD_PURPOSES = [
      "avatar",
      "cover",
      "product",
      "chat",
      "packed_proof",
      "dispute",
      "general"
    ];
    __name(validateAndSanitizeUploadFile, "validateAndSanitizeUploadFile");
    __name(sanitizeNotificationPrefs, "sanitizeNotificationPrefs");
    __name(sanitizePrivacySettings, "sanitizePrivacySettings");
  }
});

// server/app.ts
import express4 from "express";
import crypto12 from "crypto";
import cookieParser from "cookie-parser";

// server/webhooks/flutterwave.ts
import crypto6 from "crypto";

// server/db/postgres.ts
import dotenv from "dotenv";
import pg from "pg";
import crypto2 from "crypto";
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  dotenv.config({ override: false });
}
var EXPECTED_SCHEMA_VERSION = "20261121_01";
var activePool = null;
var isPgMem = false;
var migrationCompleted = false;
var isMigrationRunner = false;
var prodSchemaVerified = false;
var lastMigrationResult = null;
function isProdRuntime() {
  return (process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL)) && !isMigrationRunner;
}
__name(isProdRuntime, "isProdRuntime");
function hashPassword(password) {
  const salt = crypto2.randomBytes(32).toString("hex");
  const hash = crypto2.pbkdf2Sync(password, salt, 6e5, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$600000$${salt}$${hash}`;
}
__name(hashPassword, "hashPassword");
function verifyPassword(password, storedHash) {
  try {
    if (!storedHash || typeof storedHash !== "string") return false;
    if (storedHash.startsWith("pbkdf2_sha256$")) {
      const parts = storedHash.split("$");
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const expectedHash = parts[3];
      const computed = crypto2.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
      return crypto2.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
    }
    const legacyParts = storedHash.split(":");
    if (legacyParts.length === 2) {
      const [salt, expectedHash] = legacyParts;
      const computed = crypto2.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
      return crypto2.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
    }
    return false;
  } catch {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
var CORE_SCHEMA_TABLES = [
  "shopit_schema_migrations",
  "shopit_migration_quarantine",
  "shopit_users",
  "shopit_sellers",
  "shopit_verifications",
  "shopit_products",
  "shopit_orders",
  "shopit_payments",
  "shopit_wallets",
  "shopit_ledger_entries",
  "shopit_disputes",
  "shopit_reports",
  "shopit_chat_conversations",
  "shopit_chat_messages",
  "shopit_audit_logs",
  "shopit_order_status_history",
  "shopit_carts",
  "shopit_wishlists",
  "shopit_notifications",
  "shopit_restock_alerts",
  "shopit_commissions",
  "shopit_otps",
  "shopit_rate_limits",
  "shopit_sessions",
  "shopit_verified_signups",
  "shopit_coupons",
  "shopit_payouts",
  "shopit_verification_documents",
  "shopit_admin_alerts",
  "shopit_platform_settings",
  "shopit_follows",
  "shopit_blocks",
  "shopit_files",
  "shopit_mutes",
  "shopit_profile_slug_history"
];
function getDatabaseUrlSource() {
  const candidates = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "NEON_DATABASE_URL",
    "DATABASE_URL_UNPOOLED"
  ];
  for (const key of candidates) {
    const val = (process.env[key] || "").trim().replace(/^["']|["']$/g, "");
    if (val) return key;
  }
  return null;
}
__name(getDatabaseUrlSource, "getDatabaseUrlSource");
function getDatabaseUrl() {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "").trim().replace(/^["']|["']$/g, "");
}
__name(getDatabaseUrl, "getDatabaseUrl");
function buildPgPoolConfig(dbUrl) {
  const parsed = new URL(dbUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`Invalid PostgreSQL URL protocol: "${parsed.protocol}" (expected postgres:// or postgresql://).`);
  }
  const host = parsed.hostname;
  if (!host) {
    throw new Error("Invalid PostgreSQL URL: missing hostname.");
  }
  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
  const user = parsed.username ? decodeURIComponent(parsed.username) : void 0;
  const password = parsed.password ? decodeURIComponent(parsed.password) : void 0;
  const rawDb = parsed.pathname.replace(/^\/+/, "");
  const database = rawDb ? decodeURIComponent(rawDb) : void 0;
  const pgOptions = parsed.searchParams.get("options") || void 0;
  const sslMode = (parsed.searchParams.get("sslmode") || "").toLowerCase();
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const isVercel = Boolean(process.env.VERCEL);
  let ssl;
  if (sslMode === "disable" || isLocalHost && !sslMode) {
    ssl = false;
  } else if (sslMode === "no-verify" || sslMode === "allow" || sslMode === "prefer" || isLocalHost && sslMode === "require") {
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = { rejectUnauthorized: true };
  }
  return {
    host,
    port,
    user,
    password,
    database,
    ...pgOptions ? { options: pgOptions } : {},
    ssl,
    max: isVercel ? 5 : 10,
    idleTimeoutMillis: 2e4,
    connectionTimeoutMillis: 1e4,
    allowExitOnIdle: isVercel
  };
}
__name(buildPgPoolConfig, "buildPgPoolConfig");
async function getPool() {
  if (activePool) return activePool;
  const dbUrl = getDatabaseUrl();
  const isProduction = (process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL)) && !isMigrationRunner;
  if (dbUrl) {
    try {
      const { Pool } = pg;
      const poolConfig = buildPgPoolConfig(dbUrl);
      const pool = new Pool(poolConfig);
      pool.on("error", (err) => {
        console.error("[Database Pool Idle Error]:", err?.message || err);
      });
      activePool = pool;
      isPgMem = false;
      console.log("[Database] Connected to external PostgreSQL database.");
      return activePool;
    } catch (err) {
      console.error("[Database Pool Init Error]", err.message);
      throw err;
    }
  }
  if (isProduction) {
    throw new Error("CRITICAL: DATABASE_URL is not configured in production environment.");
  }
  try {
    const { newDb } = await import("pg-mem");
    const memDb = newDb();
    memDb.public.registerFunction({
      name: "now",
      implementation: /* @__PURE__ */ __name(() => /* @__PURE__ */ new Date(), "implementation")
    });
    memDb.public.registerFunction({
      name: "nullif",
      implementation: /* @__PURE__ */ __name((a, b) => a === b ? null : a, "implementation")
    });
    memDb.public.registerFunction({
      name: "round",
      implementation: /* @__PURE__ */ __name((x) => Math.round(Number(x)), "implementation")
    });
    const { Pool } = memDb.adapters.createPg();
    activePool = new Pool();
    isPgMem = true;
    console.log("[Database] Initialized in-memory PostgreSQL engine for local development/tests.");
    return activePool;
  } catch (err) {
    console.error("[pg-mem init error]", err.message);
    throw new Error("No database connection available and pg-mem failed to initialize.");
  }
}
__name(getPool, "getPool");
async function ensureSchemaReady() {
  if (isProdRuntime()) {
    if (prodSchemaVerified) return;
    const status = await verifyDatabaseSchema();
    if (!status.ok) {
      throw new Error(status.migrationError || 'Database schema is not at the expected version. Run "npm run migrate" at deploy time.');
    }
    prodSchemaVerified = true;
    return;
  }
  if (!migrationCompleted) {
    await runMigration();
  }
}
__name(ensureSchemaReady, "ensureSchemaReady");
async function query(text, params) {
  const pool = await getPool();
  await ensureSchemaReady();
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err?.code === "42P01" && !isProdRuntime()) {
      console.warn("[PostgreSQL Query Recovery] Missing relation detected (42P01). Re-running migration in non-production runtime.");
      migrationCompleted = false;
      await runMigration();
      return await pool.query(text, params);
    }
    console.error("[PostgreSQL Query Error]:", err.message);
    throw err;
  }
}
__name(query, "query");
async function withTransaction(fn) {
  const pool = await getPool();
  await ensureSchemaReady();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
    }
    if (err?.code === "42P01" && !isProdRuntime()) {
      migrationCompleted = false;
    }
    throw err;
  } finally {
    client.release();
  }
}
__name(withTransaction, "withTransaction");
async function verifyDatabaseSchema() {
  try {
    const pool = await getPool();
    const missingTables = [];
    for (const table of CORE_SCHEMA_TABLES) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
      } catch {
        missingTables.push(table);
      }
    }
    let schemaVersion = null;
    if (!missingTables.includes("shopit_schema_migrations")) {
      try {
        const verRes = await pool.query(
          `SELECT version FROM shopit_schema_migrations ORDER BY applied_at DESC LIMIT 1`
        );
        schemaVersion = verRes.rows[0]?.version ? String(verRes.rows[0].version) : null;
      } catch (verErr) {
        return {
          ok: false,
          schemaVersion: null,
          expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
          missingTables,
          migrationError: `Unable to read shopit_schema_migrations: ${verErr?.message || "unknown error"}`,
          error: verErr?.message
        };
      }
    }
    const versionMatches = schemaVersion === EXPECTED_SCHEMA_VERSION;
    const ok = missingTables.length === 0 && versionMatches;
    let migrationError;
    if (missingTables.length > 0) {
      migrationError = `Missing core schema table(s): ${missingTables.join(", ")}. Run "npm run migrate" during deploy.`;
    } else if (!versionMatches) {
      migrationError = `Schema version mismatch: database is at "${schemaVersion || "unversioned"}", expected "${EXPECTED_SCHEMA_VERSION}". Run "npm run migrate".`;
    }
    if (ok) {
      prodSchemaVerified = true;
    }
    return {
      ok,
      schemaVersion,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      missingTables,
      ...migrationError ? { migrationError, error: migrationError } : {}
    };
  } catch (err) {
    return {
      ok: false,
      schemaVersion: null,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      missingTables: [...CORE_SCHEMA_TABLES],
      migrationError: err.message,
      error: err.message
    };
  }
}
__name(verifyDatabaseSchema, "verifyDatabaseSchema");
async function pingPostgres() {
  try {
    const pool = await getPool();
    const res = await pool.query("SELECT 1 AS alive");
    const isAlive = res?.rows?.[0]?.alive === 1;
    if (!isAlive) {
      return {
        ok: false,
        isPgMem,
        schemaOk: false,
        schemaVersion: null,
        expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
        provider: isPgMem ? "pg-mem (local dev)" : `PostgreSQL (${getDatabaseUrlSource() || "DATABASE_URL"})`,
        migrationError: "Database heartbeat query (SELECT 1) failed",
        error: "SELECT 1 check failed"
      };
    }
    if (!isProdRuntime() && !migrationCompleted) {
      await runMigration();
    }
    const schemaCheck = await verifyDatabaseSchema();
    return {
      ok: schemaCheck.ok,
      schemaOk: schemaCheck.ok,
      schemaVersion: schemaCheck.schemaVersion,
      expectedSchemaVersion: schemaCheck.expectedSchemaVersion,
      ...schemaCheck.missingTables.length > 0 ? { missingTables: schemaCheck.missingTables } : {},
      ...schemaCheck.migrationError ? { migrationError: schemaCheck.migrationError, error: schemaCheck.migrationError } : {},
      isPgMem,
      provider: isPgMem ? "pg-mem (local dev)" : `PostgreSQL (${getDatabaseUrlSource() || "DATABASE_URL"})`
    };
  } catch (err) {
    return {
      ok: false,
      schemaOk: false,
      schemaVersion: null,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      isPgMem,
      provider: isPgMem ? "pg-mem (local dev)" : `PostgreSQL (${getDatabaseUrlSource() || "DATABASE_URL"})`,
      migrationError: err.message,
      error: err.message
    };
  }
}
__name(pingPostgres, "pingPostgres");
async function getDatabaseHealthStats() {
  const dbUrl = getDatabaseUrl();
  let databaseHost = "pg-mem";
  if (dbUrl) {
    try {
      databaseHost = new URL(dbUrl).hostname || "postgres";
    } catch {
      databaseHost = "postgres";
    }
  }
  let tableCount = 0;
  let databaseSizeBytes = 0;
  let fileStorageBytes = 0;
  let fileCount = 0;
  try {
    const pool = await getPool();
    if (!isProdRuntime() && !migrationCompleted) {
      await runMigration();
    }
    if (isPgMem) {
      databaseHost = "pg-mem";
      tableCount = CORE_SCHEMA_TABLES.length;
    } else {
      const [tblRes, sizeRes] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'public'`
        ),
        pool.query(`SELECT pg_database_size(current_database())::bigint AS size_bytes`)
      ]);
      tableCount = Number(tblRes.rows[0]?.cnt || 0);
      databaseSizeBytes = Number(sizeRes.rows[0]?.size_bytes || 0);
    }
    const fileRes = await pool.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes, COUNT(*)::int AS cnt FROM shopit_files`
    );
    fileStorageBytes = Number(fileRes.rows[0]?.used_bytes || 0);
    fileCount = Number(fileRes.rows[0]?.cnt || 0);
    if (isPgMem && databaseSizeBytes === 0) {
      databaseSizeBytes = Math.round(fileStorageBytes * 1.35);
    }
  } catch {
  }
  const databaseSizeMb = Math.round(databaseSizeBytes / (1024 * 1024) * 100) / 100;
  const fileStorageMb = Math.round(fileStorageBytes / (1024 * 1024) * 100) / 100;
  return {
    databaseHost,
    tableCount,
    databaseSizeBytes,
    databaseSizeMb,
    fileStorageBytes,
    fileStorageMb,
    fileCount
  };
}
__name(getDatabaseHealthStats, "getDatabaseHealthStats");
async function pingRedis() {
  const kvUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const kvToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!kvUrl || !kvToken) {
    return { ok: false, error: "KV_REST_API_URL not configured" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4e3);
  try {
    const url = `${kvUrl.replace(/\/$/, "")}/ping`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${kvToken}` },
      signal: controller.signal
    });
    if (!res.ok) {
      return { ok: false, error: `Upstash returned HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: data.result === "PONG" || !!data.result };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}
__name(pingRedis, "pingRedis");
var migrationPromise = null;
async function runMigration() {
  if (migrationCompleted && lastMigrationResult) return lastMigrationResult;
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const pool = await getPool();
    console.log(`[Database Migration] Running schema migration (target version ${EXPECTED_SCHEMA_VERSION}) on PostgreSQL...`);
    const migrationSql = `
      -- 0. Schema Version Registry & Zero-Loss Orphan Quarantine
      CREATE TABLE IF NOT EXISTS shopit_schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        summary JSONB DEFAULT '{}',
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shopit_migration_quarantine (
        id VARCHAR(80) PRIMARY KEY,
        source_table VARCHAR(64) NOT NULL,
        source_pk VARCHAR(128) NOT NULL,
        reason TEXT NOT NULL,
        row_data JSONB NOT NULL DEFAULT '{}',
        quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        schema_version VARCHAR(64)
      );
      CREATE INDEX IF NOT EXISTS idx_shopit_quarantine_table ON shopit_migration_quarantine (source_table, quarantined_at DESC);

      -- 1. Users Table
      CREATE TABLE IF NOT EXISTS shopit_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'buyer',
      sub_role VARCHAR(50),
      token_version INTEGER NOT NULL DEFAULT 1,
      is_verified_email BOOLEAN NOT NULL DEFAULT false,
      age INTEGER,
      has_guardian_consent BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      is_banned BOOLEAN NOT NULL DEFAULT false,
      ban_reason TEXT,
      display_name VARCHAR(60),
      profile_slug VARCHAR(100),
      avatar_url TEXT,
      cover_url TEXT,
      tagline VARCHAR(80),
      bio VARCHAR(300),
      location_state VARCHAR(100),
      campus VARCHAR(120),
      location_area VARCHAR(120),
      interests JSONB DEFAULT '[]',
      languages JSONB DEFAULT '[]',
      notification_prefs JSONB DEFAULT '{"emailOrders":true,"emailMessages":true,"emailFollowers":true,"emailRestock":true}',
      privacy_settings JSONB DEFAULT '{"profileVisibility":"public","whoCanFollow":"everyone","whoCanMessage":"everyone","showFollowersList":true,"showFollowingList":true,"showLastSeen":true}',
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_users_email ON shopit_users (email);
    CREATE INDEX IF NOT EXISTS idx_shopit_users_role ON shopit_users (role);
    CREATE INDEX IF NOT EXISTS idx_shopit_users_created_at ON shopit_users (created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_users_profile_slug ON shopit_users (profile_slug);

    -- 2. Sellers Table
    CREATE TABLE IF NOT EXISTS shopit_sellers (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES shopit_users(id) ON DELETE CASCADE,
      shop_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      bio TEXT,
      shop_story VARCHAR(600),
      craft_materials VARCHAR(300),
      processing_time VARCHAR(60),
      delivery_options JSONB DEFAULT '{}',
      campus VARCHAR(255),
      location_state VARCHAR(100),
      location_city VARCHAR(100),
      location_area VARCHAR(100),
      is_verified_seller BOOLEAN NOT NULL DEFAULT false,
      verification_status VARCHAR(50) NOT NULL DEFAULT 'not_started',
      under_18 BOOLEAN DEFAULT false,
      guardian_consent BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      guardian_phone VARCHAR(50),
      badges JSONB DEFAULT '[]',
      vacation_mode BOOLEAN DEFAULT false,
      logo_url TEXT,
      banner_url TEXT,
      rating NUMERIC(3,2) DEFAULT 5.0,
      sales_count INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_sellers_user_id ON shopit_sellers (user_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_sellers_status ON shopit_sellers (verification_status);

    -- 3. Verification Submissions Table
    CREATE TABLE IF NOT EXISTS shopit_verifications (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64),
      shop_name VARCHAR(255),
      owner_name VARCHAR(255),
      id_type VARCHAR(100),
      document_type VARCHAR(100),
      id_number_masked VARCHAR(100),
      full_nin_last4 VARCHAR(10),
      nin_last4 VARCHAR(10),
      id_hash VARCHAR(255),
      document_url TEXT,
      selfie_url TEXT,
      under_18 BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      guardian_phone VARCHAR(50),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      notes TEXT,
      rejection_reason TEXT,
      admin_notes TEXT,
      reviewed_by VARCHAR(255),
      reviewed_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_verif_seller ON shopit_verifications (seller_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_verif_status ON shopit_verifications (status);

    -- 4. Products Table (Kobo-only money columns + FK to shopit_sellers)
    CREATE TABLE IF NOT EXISTS shopit_products (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL REFERENCES shopit_sellers(id) ON DELETE CASCADE,
      seller_shop_name VARCHAR(255),
      seller_campus VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      seller_price_kobo BIGINT NOT NULL DEFAULT 0,
      service_fee_kobo BIGINT NOT NULL DEFAULT 0,
      display_price_kobo BIGINT NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 1,
      images JSONB DEFAULT '[]',
      delivery_pickup_fee_kobo BIGINT NOT NULL DEFAULT 0,
      delivery_local_fee_kobo BIGINT NOT NULL DEFAULT 0,
      delivery_buyer_arranges BOOLEAN DEFAULT false,
      location_state VARCHAR(100),
      location_city VARCHAR(100),
      location_area VARCHAR(100),
      seller_badges JSONB DEFAULT '[]',
      rating NUMERIC(3,2) DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      reviews JSONB DEFAULT '[]',
      is_sold_out BOOLEAN DEFAULT false,
      is_new_arrival BOOLEAN DEFAULT true,
      is_paused BOOLEAN DEFAULT false,
      is_draft BOOLEAN DEFAULT false,
      is_pinned BOOLEAN DEFAULT false,
      pinned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_products_seller ON shopit_products (seller_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_category ON shopit_products (category);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_created ON shopit_products (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_pinned ON shopit_products (seller_id, is_pinned DESC, pinned_at DESC);

    -- 5. Orders Table (Kobo-only money columns + FK to shopit_users)
    CREATE TABLE IF NOT EXISTS shopit_orders (
      id VARCHAR(64) PRIMARY KEY,
      buyer_id VARCHAR(64) REFERENCES shopit_users(id) ON DELETE SET NULL,
      buyer_name VARCHAR(255),
      buyer_email VARCHAR(255),
      buyer_masked_id VARCHAR(64),
      items JSONB NOT NULL DEFAULT '[]',
      subtotal_kobo BIGINT NOT NULL DEFAULT 0,
      service_fee_kobo BIGINT NOT NULL DEFAULT 0,
      delivery_fee_kobo BIGINT NOT NULL DEFAULT 0,
      discount_total_kobo BIGINT NOT NULL DEFAULT 0,
      coupon_code VARCHAR(50),
      grand_total_kobo BIGINT NOT NULL DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT 'online',
      payment_reference VARCHAR(255) UNIQUE,
      handshake_otp VARCHAR(10),
      handshake_verified BOOLEAN DEFAULT false,
      status VARCHAR(50) NOT NULL DEFAULT 'pending_payment',
      campus VARCHAR(255),
      delivery_area VARCHAR(255),
      pickup_point VARCHAR(255),
      notes TEXT,
      packed_photo_url TEXT,
      admin_hold BOOLEAN DEFAULT false,
      unshipped_reminder_sent_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      stock_reserved BOOLEAN DEFAULT false,
      expires_at TIMESTAMPTZ,
      auto_release_at TIMESTAMPTZ,
      packed_at TIMESTAMPTZ,
      shipped_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      has_review BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_orders_ref ON shopit_orders (payment_reference);
    CREATE INDEX IF NOT EXISTS idx_shopit_orders_status ON shopit_orders (status);
    CREATE INDEX IF NOT EXISTS idx_shopit_orders_created ON shopit_orders (created_at DESC);

    -- 6. Payments Table (Kobo-only money columns + FK to shopit_orders)
    CREATE TABLE IF NOT EXISTS shopit_payments (
      reference VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(64) REFERENCES shopit_orders(id) ON DELETE CASCADE,
      amount_kobo BIGINT NOT NULL DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'NGN',
      channel VARCHAR(50),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      webhook_received BOOLEAN DEFAULT false,
      customer_email VARCHAR(255),
      data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_payments_order ON shopit_payments (order_id);

    -- 7. Wallets Table (Kobo-only money columns + FK to shopit_sellers)
    CREATE TABLE IF NOT EXISTS shopit_wallets (
      seller_id VARCHAR(64) PRIMARY KEY REFERENCES shopit_sellers(id) ON DELETE CASCADE,
      pending_balance_kobo BIGINT NOT NULL DEFAULT 0,
      available_balance_kobo BIGINT NOT NULL DEFAULT 0,
      total_withdrawn_kobo BIGINT NOT NULL DEFAULT 0,
      is_frozen BOOLEAN NOT NULL DEFAULT false,
      freeze_reason TEXT,
      payout_accounts JSONB DEFAULT '[]',
      active_payout_account_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_shopit_wallet_non_negative CHECK (
        pending_balance_kobo >= 0 AND available_balance_kobo >= 0 AND total_withdrawn_kobo >= 0
      )
    );

    -- 8. Ledger Entries Table (Append-only immutable, Kobo-only + FKs to shopit_wallets & shopit_orders)
    CREATE TABLE IF NOT EXISTS shopit_ledger_entries (
      id VARCHAR(64) PRIMARY KEY,
      wallet_id VARCHAR(64) NOT NULL REFERENCES shopit_wallets(seller_id) ON DELETE CASCADE,
      order_id VARCHAR(64) REFERENCES shopit_orders(id) ON DELETE SET NULL,
      type VARCHAR(50) NOT NULL,
      amount_kobo BIGINT NOT NULL DEFAULT 0,
      fee_kobo BIGINT NOT NULL DEFAULT 0,
      balance_after_kobo BIGINT NOT NULL DEFAULT 0,
      balance_type VARCHAR(20) NOT NULL DEFAULT 'pending',
      status VARCHAR(50) DEFAULT 'completed',
      description TEXT NOT NULL,
      reference VARCHAR(255),
      idempotency_key VARCHAR(255) UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_ledger_wallet ON shopit_ledger_entries (wallet_id, created_at DESC);

    -- 9. Disputes Table (Kobo-only money column + FKs to orders, sellers, users)
    CREATE TABLE IF NOT EXISTS shopit_disputes (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL REFERENCES shopit_orders(id) ON DELETE CASCADE,
      seller_id VARCHAR(64) NOT NULL REFERENCES shopit_sellers(id) ON DELETE CASCADE,
      buyer_id VARCHAR(64) REFERENCES shopit_users(id) ON DELETE SET NULL,
      buyer_name VARCHAR(255),
      buyer_masked_id VARCHAR(64),
      seller_shop_name VARCHAR(255),
      reason VARCHAR(255) NOT NULL,
      description TEXT,
      amount_held_in_escrow_kobo BIGINT NOT NULL DEFAULT 0,
      evidence_photo_url TEXT,
      seller_packed_photo_url TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      resolution_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_disputes_order ON shopit_disputes (order_id);

    -- 10. Reports Table
    CREATE TABLE IF NOT EXISTS shopit_reports (
      id VARCHAR(64) PRIMARY KEY,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(64) NOT NULL,
      target_title VARCHAR(255),
      reporter_email VARCHAR(255),
      reason VARCHAR(255) NOT NULL,
      details TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      action_logs JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_reports_status ON shopit_reports (status);

    -- 11. Chat Conversations Table
    CREATE TABLE IF NOT EXISTS shopit_chat_conversations (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64),
      product_id VARCHAR(64),
      product_title VARCHAR(255),
      product_image TEXT,
      buyer_id VARCHAR(64) NOT NULL,
      buyer_masked_id VARCHAR(64),
      seller_id VARCHAR(64) NOT NULL,
      seller_shop_name VARCHAR(255),
      last_message TEXT,
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      is_chat_locked BOOLEAN DEFAULT false,
      bypass_violations_count INTEGER DEFAULT 0,
      buyer_last_read_at TIMESTAMPTZ,
      seller_last_read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 12. Chat Messages Table
    CREATE TABLE IF NOT EXISTS shopit_chat_messages (
      id VARCHAR(64) PRIMARY KEY,
      conversation_id VARCHAR(64) NOT NULL,
      sender_id VARCHAR(64) NOT NULL,
      sender_role VARCHAR(20) NOT NULL,
      sender_masked_name VARCHAR(255),
      content TEXT NOT NULL,
      is_blocked_bypass BOOLEAN DEFAULT false,
      preset_offer JSONB,
      attachment JSONB,
      reply_to_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_chat_conv ON shopit_chat_messages (conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_shopit_chat_conv_created_id ON shopit_chat_messages (conversation_id, created_at ASC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_shopit_chat_convs_buyer ON shopit_chat_conversations (buyer_id, last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_chat_convs_seller ON shopit_chat_conversations (seller_id, last_message_at DESC);

    -- 13. Audit Logs Table (Immutable security event logging)
    CREATE TABLE IF NOT EXISTS shopit_audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      actor_id VARCHAR(64),
      actor_email VARCHAR(255),
      actor_role VARCHAR(50),
      target_type VARCHAR(100),
      target_id VARCHAR(255),
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_audit_action ON shopit_audit_logs (action);
    CREATE INDEX IF NOT EXISTS idx_shopit_audit_actor ON shopit_audit_logs (actor_email);
    CREATE INDEX IF NOT EXISTS idx_shopit_audit_created ON shopit_audit_logs (created_at DESC);

    -- 14. Order Status History Table
    CREATE TABLE IF NOT EXISTS shopit_order_status_history (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      previous_status VARCHAR(50),
      new_status VARCHAR(50) NOT NULL,
      changed_by VARCHAR(64),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_osh_order ON shopit_order_status_history (order_id, created_at ASC);

    -- 15. User Carts Table
    CREATE TABLE IF NOT EXISTS shopit_carts (
      user_id VARCHAR(64) PRIMARY KEY,
      items JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 16. User Wishlists Table
    CREATE TABLE IF NOT EXISTS shopit_wishlists (
      user_id VARCHAR(64) PRIMARY KEY,
      product_ids JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 17. Notifications Table
    CREATE TABLE IF NOT EXISTS shopit_notifications (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN NOT NULL DEFAULT false,
      link VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_notif_user ON shopit_notifications (user_id, created_at DESC);

    -- 17b. Product Restock Alerts Table (Sold Out -> Notify Me)
    CREATE TABLE IF NOT EXISTS shopit_restock_alerts (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      email VARCHAR(255),
      notified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (product_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_restock_product ON shopit_restock_alerts (product_id, notified);

    -- 18. Custom Craft Commissions Table (Kobo-only)
    CREATE TABLE IF NOT EXISTS shopit_commissions (
      id VARCHAR(64) PRIMARY KEY,
      buyer_id VARCHAR(64) NOT NULL,
      buyer_name VARCHAR(255),
      seller_id VARCHAR(64) NOT NULL,
      seller_shop_name VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      budget_kobo BIGINT NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      milestones JSONB DEFAULT '[]',
      reference VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_comm_buyer ON shopit_commissions (buyer_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_comm_seller ON shopit_commissions (seller_id);

    -- 19. OTP Storage Table (Zero File System Dependencies)
    CREATE TABLE IF NOT EXISTS shopit_otps (
      key VARCHAR(255) PRIMARY KEY,
      data JSONB NOT NULL,
      expires_at BIGINT NOT NULL
    );

    -- 20. Rate Limits Table
    CREATE TABLE IF NOT EXISTS shopit_rate_limits (
      key VARCHAR(255) PRIMARY KEY,
      timestamps JSONB NOT NULL
    );

    -- 21. Persistent Sessions Table (Shared across Vercel serverless instances)
    CREATE TABLE IF NOT EXISTS shopit_sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      data JSONB NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_sessions_user ON shopit_sessions (user_id);

    -- 22. Verified Signup OTP Tokens (Server-side proof required by /auth/register)
    CREATE TABLE IF NOT EXISTS shopit_verified_signups (
      email VARCHAR(255) PRIMARY KEY,
      token_hash VARCHAR(255) NOT NULL,
      expires_at BIGINT NOT NULL
    );

    -- 23. Coupons Table (Database-authoritative discounts)
    CREATE TABLE IF NOT EXISTS shopit_coupons (
      code VARCHAR(50) PRIMARY KEY,
      discount_kobo BIGINT NOT NULL,
      min_subtotal_kobo BIGINT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      max_uses INTEGER,
      current_uses INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ
    );

    -- 24. Payouts Table
    CREATE TABLE IF NOT EXISTS shopit_payouts (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      amount_kobo BIGINT NOT NULL,
      fee_kobo BIGINT NOT NULL DEFAULT 0,
      total_deduction_kobo BIGINT NOT NULL,
      reference VARCHAR(255) UNIQUE NOT NULL,
      bank_name VARCHAR(255),
      bank_code VARCHAR(32),
      account_number VARCHAR(32),
      account_name VARCHAR(255),
      transfer_code VARCHAR(128),
      flw_transfer_id VARCHAR(64),
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      provider_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_payouts_seller ON shopit_payouts (seller_id, created_at DESC);

    -- 25. Encrypted Identity Verification Documents
    CREATE TABLE IF NOT EXISTS shopit_verification_documents (
      id VARCHAR(128) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      doc_type VARCHAR(64) NOT NULL,
      encrypted_data TEXT NOT NULL,
      mime_type VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_verif_docs_seller ON shopit_verification_documents (seller_id);

    -- 26. Admin Alerts & Transactional Feed Table
    CREATE TABLE IF NOT EXISTS shopit_admin_alerts (
      alert_key VARCHAR(255) PRIMARY KEY,
      id VARCHAR(64),
      alert_type VARCHAR(50) NOT NULL DEFAULT 'new_user',
      user_id VARCHAR(64),
      user_email VARCHAR(255),
      user_name VARCHAR(255),
      user_role VARCHAR(32),
      title VARCHAR(255),
      message TEXT,
      is_read BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_created ON shopit_admin_alerts (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_type_read ON shopit_admin_alerts (alert_type, is_read);

    -- 27. Persistent Platform Settings Table (Broadcasts, Killswitches, Fee Policy)
    CREATE TABLE IF NOT EXISTS shopit_platform_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 28. Follows Table (With status for Under-18 / Private approval workflows)
    CREATE TABLE IF NOT EXISTS shopit_follows (
      id VARCHAR(64) PRIMARY KEY,
      follower_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      following_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'accepted',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (follower_id, following_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_follows_follower ON shopit_follows (follower_id, status);
    CREATE INDEX IF NOT EXISTS idx_shopit_follows_following ON shopit_follows (following_id, status);

    -- 29. Blocks Table
    CREATE TABLE IF NOT EXISTS shopit_blocks (
      id VARCHAR(64) PRIMARY KEY,
      blocker_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      blocked_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (blocker_id, blocked_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_blocks_blocker ON shopit_blocks (blocker_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_blocks_blocked ON shopit_blocks (blocked_id);

    -- 30. Unified File Storage Table (PostgreSQL-backed, zero local disk dependencies)
    CREATE TABLE IF NOT EXISTS shopit_files (
      id VARCHAR(80) PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      purpose VARCHAR(40) NOT NULL DEFAULT 'general',
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 VARCHAR(64) NOT NULL,
      data_base64 TEXT NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT true,
      conversation_id VARCHAR(64),
      order_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_files_owner ON shopit_files (owner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_files_conv ON shopit_files (conversation_id);

    -- 31. Mutes Table (Mute notifications/alerts from a user without blocking)
    CREATE TABLE IF NOT EXISTS shopit_mutes (
      id VARCHAR(64) PRIMARY KEY,
      muter_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      muted_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (muter_id, muted_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_mutes_muter ON shopit_mutes (muter_id);

    -- 32. Profile Slug History Table (Old-slug redirects when display name changes)
    CREATE TABLE IF NOT EXISTS shopit_profile_slug_history (
      slug VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_slug_history_user ON shopit_profile_slug_history (user_id);
  `;
    const alterStatements = [
      // 1. shopit_users
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'buyer';",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS sub_role VARCHAR(50);",
      "ALTER TABLE shopit_users ALTER COLUMN sub_role DROP DEFAULT;",
      "UPDATE shopit_users SET sub_role = NULL WHERE role != 'admin' AND sub_role = 'superadmin';",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS is_verified_email BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_users ALTER COLUMN is_verified_email SET DEFAULT false;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS age INTEGER;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS has_guardian_consent BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS ban_reason TEXT;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'not_started';",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(60);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS profile_slug VARCHAR(100);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS cover_url TEXT;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS tagline VARCHAR(80);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS bio VARCHAR(300);",
      "ALTER TABLE shopit_users ALTER COLUMN bio TYPE VARCHAR(300);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS location_state VARCHAR(100);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS campus VARCHAR(120);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS location_area VARCHAR(120);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS notification_prefs JSONB;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS privacy_settings JSONB;",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_users_profile_slug_heal ON shopit_users (profile_slug);",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      // 2. shopit_sellers
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS email VARCHAR(255);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS bio TEXT;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS shop_story VARCHAR(600);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS craft_materials VARCHAR(300);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS processing_time VARCHAR(60);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS delivery_options JSONB DEFAULT '{}'::jsonb;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS campus VARCHAR(255);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS location_state VARCHAR(100);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS location_area VARCHAR(100);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'not_started';",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS under_18 BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS guardian_consent BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS logo_url TEXT;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS banner_url TEXT;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verified_legal_name VARCHAR(255);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verified_nin_last4 VARCHAR(10);",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      // 3. shopit_verifications
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS id_type VARCHAR(100);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS document_type VARCHAR(100);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS id_number_masked VARCHAR(100);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS full_nin_last4 VARCHAR(10);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS nin_last4 VARCHAR(10);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS id_hash VARCHAR(255);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS document_url TEXT;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS selfie_url TEXT;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS under_18 BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS guardian_consent BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS notes TEXT;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS admin_notes TEXT;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      // 4. shopit_products (kobo-only money columns)
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_campus VARCHAR(255);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS title VARCHAR(255);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS description TEXT;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS category VARCHAR(100);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_price_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS service_fee_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS display_price_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 1;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_pickup_fee_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_local_fee_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_buyer_arranges BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_state VARCHAR(100);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_area VARCHAR(100);",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_badges JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT true;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      "CREATE INDEX IF NOT EXISTS idx_shopit_products_pinned_heal ON shopit_products (seller_id, is_pinned DESC, pinned_at DESC);",
      // 5. shopit_orders (kobo-only money columns)
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_email VARCHAR(255);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_masked_id VARCHAR(64);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS subtotal_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS service_fee_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_fee_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS discount_total_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS grand_total_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'online';",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS handshake_otp VARCHAR(10);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS handshake_verified BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_payment';",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS campus VARCHAR(255);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_area VARCHAR(255);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS pickup_point VARCHAR(255);",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS notes TEXT;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS packed_photo_url TEXT;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS admin_hold BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS unshipped_reminder_sent_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS has_review BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_orders_ref_unique ON shopit_orders (payment_reference);",
      "ALTER TABLE shopit_payouts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);",
      "ALTER TABLE shopit_payouts ADD COLUMN IF NOT EXISTS transfer_code VARCHAR(128);",
      "ALTER TABLE shopit_payouts ADD COLUMN IF NOT EXISTS flw_transfer_id VARCHAR(64);",
      // 6. shopit_wallets (kobo-only money columns)
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS pending_balance_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS available_balance_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS total_withdrawn_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS freeze_reason TEXT;",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS payout_accounts JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS active_payout_account_id VARCHAR(64);",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_wallets ADD CONSTRAINT chk_shopit_wallet_non_negative CHECK (pending_balance_kobo >= 0 AND available_balance_kobo >= 0 AND total_withdrawn_kobo >= 0);",
      // 7. shopit_payments (kobo-only money column)
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS amount_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS channel VARCHAR(50);",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS webhook_received BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      // 8. shopit_ledger_entries (kobo-only money columns)
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS wallet_id VARCHAR(64);",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS type VARCHAR(50);",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS amount_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS fee_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_after_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_type VARCHAR(20) DEFAULT 'pending';",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS description TEXT;",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS reference VARCHAR(255);",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);",
      "ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_ledger_idemp_unique ON shopit_ledger_entries (idempotency_key);",
      // 9. shopit_disputes (kobo-only money column)
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_masked_id VARCHAR(64);",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS reason VARCHAR(255);",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS description TEXT;",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS amount_held_in_escrow_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT;",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_packed_photo_url TEXT;",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open';",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS resolution_notes TEXT;",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      // 10. shopit_reports
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS target_type VARCHAR(50);",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS target_id VARCHAR(64);",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS target_title VARCHAR(255);",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS reporter_email VARCHAR(255);",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS reason VARCHAR(255);",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS details TEXT;",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open';",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS action_logs JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      // 11. shopit_commissions (kobo-only)
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS title VARCHAR(255);",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS description TEXT;",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS budget_kobo BIGINT DEFAULT 0;",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb;",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS reference VARCHAR(255);",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
      // 12. shopit_admin_alerts
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS id VARCHAR(64);",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(50) DEFAULT 'new_user';",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_role VARCHAR(32);",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS title VARCHAR(255);",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS message TEXT;",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;",
      "ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();",
      "CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_created_heal ON shopit_admin_alerts (created_at DESC);",
      "CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_type_read_heal ON shopit_admin_alerts (alert_type, is_read);",
      // 13. Chat Conversations & Messages read/attachment healing
      "ALTER TABLE shopit_chat_conversations ADD COLUMN IF NOT EXISTS buyer_last_read_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_chat_conversations ADD COLUMN IF NOT EXISTS seller_last_read_at TIMESTAMPTZ;",
      "ALTER TABLE shopit_chat_messages ADD COLUMN IF NOT EXISTS attachment JSONB;",
      "ALTER TABLE shopit_chat_messages ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR(64);"
    ];
    const stripLeadingComments = /* @__PURE__ */ __name((sql) => sql.split("\n").map((line) => line.replace(/^\s*--.*$/, "")).join("\n").trim(), "stripLeadingComments");
    let processedMigrationSql = migrationSql;
    if (isPgMem) {
      processedMigrationSql = processedMigrationSql.replace(/\bJSONB\b/gi, "TEXT").replace(/\bJSON\b/gi, "TEXT").replace(/DEFAULT\s+'[^']*'/gi, "").replace(/DEFAULT\s+"[^"]*"/gi, "");
    }
    const allStatements = processedMigrationSql.split(";").map(stripLeadingComments).filter((s) => s.length > 0);
    const tableStatements = allStatements.filter((s) => /^CREATE\s+TABLE/i.test(s));
    const sqlIndexStatements = allStatements.filter((s) => /^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s));
    const otherSqlStatements = allStatements.filter(
      (s) => !/^CREATE\s+TABLE/i.test(s) && !/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s)
    );
    const alterOnlyStatements = alterStatements.map(stripLeadingComments).filter((s) => s.length > 0 && !/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s));
    const alterIndexStatements = alterStatements.map(stripLeadingComments).filter((s) => /^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s));
    const isBenignDdlError = /* @__PURE__ */ __name((stmt, err) => {
      const msg = String(err?.message || "").toLowerCase();
      const code = String(err?.code || "");
      if (code === "42P07" || code === "42710" || code === "42701" || msg.includes("already exists")) {
        return true;
      }
      if (isPgMem && (stmt.includes("DROP DEFAULT") || stmt.includes("SET DEFAULT") || stmt.includes("DROP CONSTRAINT") || stmt.includes("ADD CONSTRAINT") || stmt.includes("ALTER COLUMN bio TYPE"))) {
        return true;
      }
      return false;
    }, "isBenignDdlError");
    for (const statement of [...tableStatements, ...otherSqlStatements]) {
      try {
        await pool.query(statement);
      } catch (err) {
        if (isPgMem) {
          console.warn("[pg-mem Migration Note - Ignored AST/DDL Error]:", err?.message || err);
          continue;
        }
        if (!isBenignDdlError(statement, err)) {
          console.error("[Migration Table DDL Error]:", err.message);
          throw err;
        }
        console.warn("[Migration Table DDL Note]:", err.message);
      }
    }
    for (const stmt of alterOnlyStatements) {
      try {
        await pool.query(stmt);
      } catch (alterErr) {
        if (!isBenignDdlError(stmt, alterErr)) {
          console.error("[Migration Column Error]:", alterErr.message);
          throw alterErr;
        }
        console.warn("[Migration Column Note]:", alterErr.message);
      }
    }
    const legacyColumnMigrations = [
      { table: "shopit_products", legacyCol: "seller_price", koboCol: "seller_price_kobo" },
      { table: "shopit_products", legacyCol: "service_fee", koboCol: "service_fee_kobo" },
      { table: "shopit_products", legacyCol: "display_price", koboCol: "display_price_kobo" },
      { table: "shopit_products", legacyCol: "delivery_pickup_fee", koboCol: "delivery_pickup_fee_kobo" },
      { table: "shopit_products", legacyCol: "delivery_local_fee", koboCol: "delivery_local_fee_kobo" },
      { table: "shopit_orders", legacyCol: "subtotal", koboCol: "subtotal_kobo" },
      { table: "shopit_orders", legacyCol: "service_fee_total", koboCol: "service_fee_kobo" },
      { table: "shopit_orders", legacyCol: "delivery_total", koboCol: "delivery_fee_kobo" },
      { table: "shopit_orders", legacyCol: "discount_total", koboCol: "discount_total_kobo" },
      { table: "shopit_orders", legacyCol: "grand_total", koboCol: "grand_total_kobo" },
      { table: "shopit_payments", legacyCol: "amount_naira", koboCol: "amount_kobo" },
      { table: "shopit_wallets", legacyCol: "pending_balance", koboCol: "pending_balance_kobo" },
      { table: "shopit_wallets", legacyCol: "available_balance", koboCol: "available_balance_kobo" },
      { table: "shopit_wallets", legacyCol: "total_withdrawn", koboCol: "total_withdrawn_kobo" },
      { table: "shopit_ledger_entries", legacyCol: "amount", koboCol: "amount_kobo" },
      { table: "shopit_ledger_entries", legacyCol: "fee", koboCol: "fee_kobo" },
      { table: "shopit_ledger_entries", legacyCol: "balance_after", koboCol: "balance_after_kobo" },
      { table: "shopit_disputes", legacyCol: "amount_held_in_escrow", koboCol: "amount_held_in_escrow_kobo" },
      { table: "shopit_commissions", legacyCol: "budget_naira", koboCol: "budget_kobo" }
    ];
    for (const m of legacyColumnMigrations) {
      try {
        await pool.query(`SELECT ${m.legacyCol} FROM ${m.table} LIMIT 0`);
        await pool.query(
          `UPDATE ${m.table} SET ${m.koboCol} = CASE WHEN COALESCE(${m.koboCol}, 0) = 0 AND COALESCE(${m.legacyCol}, 0) <> 0 THEN CAST((${m.legacyCol} * 100) AS BIGINT) ELSE COALESCE(${m.koboCol}, 0) END`
        );
        try {
          await pool.query(`ALTER TABLE ${m.table} DROP COLUMN IF EXISTS ${m.legacyCol}`);
        } catch {
        }
      } catch {
      }
    }
    const quarantined = {
      payments: 0,
      wallets: 0,
      ledgerEntries: 0,
      disputes: 0
    };
    let orphanOrdersNullified = 0;
    let deletedOrphanProducts = 0;
    const deletedOrphanProductIds = [];
    const qClient = await pool.connect();
    try {
      await qClient.query("BEGIN");
      try {
        const orphanProdRes = await qClient.query(
          `SELECT p.id FROM shopit_products p WHERE NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = p.seller_id)`
        );
        if (orphanProdRes.rows.length > 0) {
          for (const r of orphanProdRes.rows) {
            deletedOrphanProductIds.push(String(r.id));
          }
          await qClient.query(
            `DELETE FROM shopit_products WHERE NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = shopit_products.seller_id)`
          );
          deletedOrphanProducts = deletedOrphanProductIds.length;
          console.warn(
            `[Migration Cleanup] Deleted ${deletedOrphanProducts} orphaned product row(s) with missing shopit_sellers parent: ${deletedOrphanProductIds.join(", ")}`
          );
        }
      } catch (prodErr) {
        console.warn("[Migration Orphan Products Note]:", prodErr?.message);
      }
      try {
        const orphanOrdRes = await qClient.query(
          `SELECT id FROM shopit_orders WHERE buyer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_users u WHERE u.id = shopit_orders.buyer_id)`
        );
        if (orphanOrdRes.rows.length > 0) {
          orphanOrdersNullified = orphanOrdRes.rows.length;
          await qClient.query(
            `UPDATE shopit_orders SET buyer_id = NULL WHERE buyer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_users u WHERE u.id = shopit_orders.buyer_id)`
          );
          console.warn(
            `[Migration Repair] Preserved ${orphanOrdersNullified} order(s) by clearing dangling buyer_id references.`
          );
        }
      } catch (ordErr) {
        console.warn("[Migration Orphan Orders Note]:", ordErr?.message);
      }
      const insertQuarantineRow = /* @__PURE__ */ __name(async (sourceTable, sourcePk, reason, rowObj) => {
        const qId = `q_${sourceTable}_${Date.now()}_${crypto2.randomBytes(4).toString("hex")}`;
        await qClient.query(
          `INSERT INTO shopit_migration_quarantine (id, source_table, source_pk, reason, row_data, quarantined_at, schema_version)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)`,
          [qId, sourceTable, sourcePk, reason, JSON.stringify(rowObj), EXPECTED_SCHEMA_VERSION]
        );
      }, "insertQuarantineRow");
      try {
        const orphanPayRes = await qClient.query(
          `SELECT * FROM shopit_payments WHERE order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_orders o WHERE o.id = shopit_payments.order_id)`
        );
        for (const row of orphanPayRes.rows) {
          const pk = String(row.reference || "");
          await insertQuarantineRow(
            "shopit_payments",
            pk,
            `Orphaned payment referencing missing order_id="${row.order_id}"`,
            row
          );
          await qClient.query(`DELETE FROM shopit_payments WHERE reference = $1`, [row.reference]);
          quarantined.payments++;
        }
      } catch (payErr) {
        console.warn("[Migration Orphan Payments Note]:", payErr?.message);
      }
      try {
        await qClient.query(
          `UPDATE shopit_ledger_entries SET order_id = NULL WHERE order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_orders o WHERE o.id = shopit_ledger_entries.order_id)`
        );
      } catch (ledOrdErr) {
        console.warn("[Migration Ledger Order Clean Note]:", ledOrdErr?.message);
      }
      try {
        const orphanWalletRes = await qClient.query(
          `SELECT * FROM shopit_wallets WHERE NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = shopit_wallets.seller_id)`
        );
        const orphanWalletIds = new Set(orphanWalletRes.rows.map((w) => String(w.seller_id)));
        const allLedgerCandidates = await qClient.query(
          `SELECT * FROM shopit_ledger_entries WHERE NOT EXISTS (SELECT 1 FROM shopit_wallets w WHERE w.seller_id = shopit_ledger_entries.wallet_id)`
        );
        for (const lRow of allLedgerCandidates.rows) {
          await insertQuarantineRow(
            "shopit_ledger_entries",
            String(lRow.id),
            `Orphaned ledger entry referencing missing wallet_id="${lRow.wallet_id}"`,
            lRow
          );
          await qClient.query(`DELETE FROM shopit_ledger_entries WHERE id = $1`, [lRow.id]);
          quarantined.ledgerEntries++;
        }
        if (orphanWalletIds.size > 0) {
          for (const wId of orphanWalletIds) {
            const wLedgerRes = await qClient.query(`SELECT * FROM shopit_ledger_entries WHERE wallet_id = $1`, [wId]);
            for (const lRow of wLedgerRes.rows) {
              await insertQuarantineRow(
                "shopit_ledger_entries",
                String(lRow.id),
                `Ledger entry attached to orphaned wallet_id="${wId}" (missing seller)`,
                lRow
              );
              await qClient.query(`DELETE FROM shopit_ledger_entries WHERE id = $1`, [lRow.id]);
              quarantined.ledgerEntries++;
            }
          }
        }
        for (const wRow of orphanWalletRes.rows) {
          await insertQuarantineRow(
            "shopit_wallets",
            String(wRow.seller_id),
            `Orphaned wallet referencing missing shopit_sellers.id="${wRow.seller_id}"`,
            wRow
          );
          await qClient.query(`DELETE FROM shopit_wallets WHERE seller_id = $1`, [wRow.seller_id]);
          quarantined.wallets++;
        }
      } catch (wallErr) {
        console.warn("[Migration Orphan Wallets Note]:", wallErr?.message);
      }
      try {
        await qClient.query(
          `UPDATE shopit_disputes SET buyer_id = NULL WHERE buyer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_users u WHERE u.id = shopit_disputes.buyer_id)`
        );
        const orphanDisputeRes = await qClient.query(
          `SELECT * FROM shopit_disputes WHERE NOT EXISTS (SELECT 1 FROM shopit_orders o WHERE o.id = shopit_disputes.order_id) OR NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = shopit_disputes.seller_id)`
        );
        for (const dRow of orphanDisputeRes.rows) {
          await insertQuarantineRow(
            "shopit_disputes",
            String(dRow.id),
            `Orphaned dispute missing required order_id="${dRow.order_id}" or seller_id="${dRow.seller_id}"`,
            dRow
          );
          await qClient.query(`DELETE FROM shopit_disputes WHERE id = $1`, [dRow.id]);
          quarantined.disputes++;
        }
      } catch (dispErr) {
        console.warn("[Migration Orphan Disputes Note]:", dispErr?.message);
      }
      await qClient.query("COMMIT");
    } catch (qErr) {
      try {
        await qClient.query("ROLLBACK");
      } catch {
      }
      throw qErr;
    } finally {
      qClient.release();
    }
    console.log(
      `[Database Migration] Quarantine summary: payments=${quarantined.payments}, wallets=${quarantined.wallets}, ledgerEntries=${quarantined.ledgerEntries}, disputes=${quarantined.disputes}, orphanOrdersNullified=${orphanOrdersNullified}, deletedOrphanProducts=${deletedOrphanProducts}`
    );
    if (!isPgMem) {
      const fkConstraints = [
        { table: "shopit_products", name: "fk_shopit_products_seller", ddl: "FOREIGN KEY (seller_id) REFERENCES shopit_sellers(id) ON DELETE CASCADE" },
        { table: "shopit_orders", name: "fk_shopit_orders_buyer", ddl: "FOREIGN KEY (buyer_id) REFERENCES shopit_users(id) ON DELETE SET NULL" },
        { table: "shopit_payments", name: "fk_shopit_payments_order", ddl: "FOREIGN KEY (order_id) REFERENCES shopit_orders(id) ON DELETE CASCADE" },
        { table: "shopit_wallets", name: "fk_shopit_wallets_seller", ddl: "FOREIGN KEY (seller_id) REFERENCES shopit_sellers(id) ON DELETE CASCADE" },
        { table: "shopit_ledger_entries", name: "fk_shopit_ledger_wallet", ddl: "FOREIGN KEY (wallet_id) REFERENCES shopit_wallets(seller_id) ON DELETE CASCADE" },
        { table: "shopit_ledger_entries", name: "fk_shopit_ledger_order", ddl: "FOREIGN KEY (order_id) REFERENCES shopit_orders(id) ON DELETE SET NULL" },
        { table: "shopit_disputes", name: "fk_shopit_disputes_order", ddl: "FOREIGN KEY (order_id) REFERENCES shopit_orders(id) ON DELETE CASCADE" },
        { table: "shopit_disputes", name: "fk_shopit_disputes_seller", ddl: "FOREIGN KEY (seller_id) REFERENCES shopit_sellers(id) ON DELETE CASCADE" },
        { table: "shopit_disputes", name: "fk_shopit_disputes_buyer", ddl: "FOREIGN KEY (buyer_id) REFERENCES shopit_users(id) ON DELETE SET NULL" }
      ];
      for (const fk of fkConstraints) {
        const exists = await pool.query(
          `SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`,
          [fk.name]
        );
        if (exists.rows.length === 0) {
          await pool.query(`ALTER TABLE ${fk.table} ADD CONSTRAINT ${fk.name} ${fk.ddl}`);
        }
      }
    }
    const indexFailures = await applyMigrationIndexes(pool, [...sqlIndexStatements, ...alterIndexStatements], isBenignDdlError);
    if (indexFailures.length > 0) {
      throw new Error(`Migration index creation failed (${indexFailures.length}): ${indexFailures.join(" | ")}`);
    }
    const missingCoreTables = [];
    for (const coreTable of CORE_SCHEMA_TABLES) {
      try {
        await pool.query(`SELECT 1 FROM ${coreTable} LIMIT 0`);
      } catch (verifyErr) {
        missingCoreTables.push(`${coreTable} (${verifyErr?.message || "missing"})`);
      }
    }
    if (missingCoreTables.length > 0) {
      throw new Error(`Migration schema verification failed. Missing core tables: ${missingCoreTables.join(", ")}`);
    }
    const defaultPlatformSettings = [
      {
        key: "broadcast",
        value: {
          id: "broad_default",
          isActive: false,
          title: "Campus Safety & Verified Handshake Advisory",
          message: "All campus order pickups must be verified using the 4-digit Handshake OTP at daylight campus pickup spots.",
          tone: "info",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          author: "Shop It Safety Desk"
        }
      },
      {
        key: "emergency_controls",
        value: {
          maintenanceMode: false,
          pauseNewOrders: false,
          pauseSellerSignups: false
        }
      },
      {
        key: "fee_settings",
        value: {
          firstMonthPromoFree: false,
          tierLowFee: 200,
          tierMidFee: 500,
          tierHighPercentage: 0.05,
          minWithdrawal: 1e3
        }
      }
    ];
    for (const ps of defaultPlatformSettings) {
      try {
        await pool.query(
          `INSERT INTO shopit_platform_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, 'system', NOW())
         ON CONFLICT (key) DO NOTHING`,
          [ps.key, JSON.stringify(ps.value)]
        );
      } catch (seedErr) {
        console.error(`[Migration Seed Error] Failed seeding platform setting "${ps.key}":`, seedErr.message);
        throw seedErr;
      }
    }
    const seedCoupons = [
      { code: "TEEDS", discountKobo: 5e4, minSubtotalKobo: 25e4 },
      { code: "FIRSTORDER", discountKobo: 3e4, minSubtotalKobo: 15e4 },
      { code: "CAMPUSLOVE", discountKobo: 5e4, minSubtotalKobo: 3e5 },
      { code: "FIRSTCRAFT", discountKobo: 4e4, minSubtotalKobo: 2e5 }
    ];
    for (const c of seedCoupons) {
      try {
        await pool.query(
          `INSERT INTO shopit_coupons (code, discount_kobo, min_subtotal_kobo, is_active, current_uses)
         VALUES ($1, $2, $3, true, 0)
         ON CONFLICT (code) DO NOTHING`,
          [c.code, c.discountKobo, c.minSubtotalKobo]
        );
      } catch (couponErr) {
        console.error(`[Migration Seed Error] Failed seeding coupon "${c.code}":`, couponErr.message);
        throw couponErr;
      }
    }
    await ensureBootstrapAdminFromEnv(pool);
    try {
      const usersToBackfill = await pool.query(
        `SELECT u.id, u.name, u.display_name, u.profile_slug, u.age, u.privacy_settings, u.notification_prefs, u.campus, u.location_area,
              s.campus AS seller_campus, s.location_area AS seller_area, s.under_18 AS seller_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.display_name IS NULL OR u.display_name = '' OR u.profile_slug IS NULL OR u.profile_slug = '' OR u.privacy_settings IS NULL OR u.notification_prefs IS NULL`
      );
      const {
        extractFirstName: extractFirstName2,
        generateUniqueProfileSlug: generateUniqueProfileSlug2,
        DEFAULT_NOTIFICATION_PREFS: DEFAULT_NOTIFICATION_PREFS2,
        DEFAULT_PRIVACY_SETTINGS: DEFAULT_PRIVACY_SETTINGS2,
        UNDER_18_PRIVACY_SETTINGS: UNDER_18_PRIVACY_SETTINGS3
      } = await Promise.resolve().then(() => (init_validation(), validation_exports));
      for (const u of usersToBackfill.rows) {
        const displayName = u.display_name && String(u.display_name).trim() ? String(u.display_name).trim().slice(0, 40) : extractFirstName2(u.name || "Member");
        const profileSlug = u.profile_slug && String(u.profile_slug).trim() ? String(u.profile_slug).trim() : await generateUniqueProfileSlug2((sql, p) => pool.query(sql, p), displayName, u.id);
        const isMinor = u.age !== null && u.age !== void 0 && Number(u.age) < 18 || Boolean(u.seller_under_18);
        const nextPrivacy = u.privacy_settings || (isMinor ? UNDER_18_PRIVACY_SETTINGS3 : DEFAULT_PRIVACY_SETTINGS2);
        const nextNotif = u.notification_prefs || DEFAULT_NOTIFICATION_PREFS2;
        const nextCampus = u.campus || u.seller_campus || null;
        const nextArea = u.location_area || u.seller_area || null;
        await pool.query(
          `UPDATE shopit_users
         SET display_name = $1,
             profile_slug = $2,
             privacy_settings = COALESCE(privacy_settings, $3::jsonb),
             notification_prefs = COALESCE(notification_prefs, $4::jsonb),
             campus = COALESCE(campus, $5),
             location_area = COALESCE(location_area, $6)
         WHERE id = $7`,
          [
            displayName,
            profileSlug,
            JSON.stringify(nextPrivacy),
            JSON.stringify(nextNotif),
            nextCampus,
            nextArea,
            u.id
          ]
        );
      }
    } catch (backfillErr) {
      console.warn("[Migration Profile Backfill Note]:", backfillErr?.message || backfillErr);
    }
    try {
      const allUsersForAlerts = await pool.query(
        `SELECT id, email, name, display_name, role, created_at FROM shopit_users`
      );
      for (const u of allUsersForAlerts.rows) {
        const alertKey = `new_user_${u.id}`;
        const alertId = `alert_u_${u.id}`;
        const labelName = String(u.display_name || u.name || u.email || "Member").trim();
        await pool.query(
          `INSERT INTO shopit_admin_alerts (
          alert_key, id, alert_type, user_id, user_email, user_name, user_role, title, message, is_read, metadata, created_at
        ) VALUES ($1, $2, 'new_user', $3, $4, $5, $6, $7, $8, false, $9, COALESCE($10, NOW()))
        ON CONFLICT (alert_key) DO NOTHING`,
          [
            alertKey,
            alertId,
            u.id,
            u.email,
            labelName,
            u.role || "buyer",
            `New ${u.role || "buyer"} registered`,
            `${labelName} (${u.email}) registered as ${u.role || "buyer"}`,
            JSON.stringify({ backfilled: true }),
            u.created_at || /* @__PURE__ */ new Date()
          ]
        );
      }
    } catch (alertBackfillErr) {
      console.warn("[Migration Admin Alert Backfill Note]:", alertBackfillErr?.message || alertBackfillErr);
    }
    const resultSummary = {
      schemaVersion: EXPECTED_SCHEMA_VERSION,
      quarantined,
      orphanOrdersNullified,
      deletedOrphanProducts,
      deletedOrphanProductIds
    };
    await pool.query(
      `INSERT INTO shopit_schema_migrations (version, summary, applied_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (version) DO UPDATE SET summary = $2::jsonb, applied_at = NOW()`,
      [EXPECTED_SCHEMA_VERSION, JSON.stringify(resultSummary)]
    );
    lastMigrationResult = resultSummary;
    migrationCompleted = true;
    prodSchemaVerified = true;
    console.log(
      `[Database Migration] Schema v${EXPECTED_SCHEMA_VERSION} verified. All tables, indexes, quarantine logs, and security schemas ready.`
    );
    return resultSummary;
  })().catch((err) => {
    migrationPromise = null;
    migrationCompleted = false;
    prodSchemaVerified = false;
    console.error("[Database Migration Critical Error]:", err.message);
    throw err;
  });
  return migrationPromise;
}
__name(runMigration, "runMigration");
async function applyMigrationIndexes(pool, indexStatements, isBenignErr) {
  const failures = [];
  const defaultBenignCheck = /* @__PURE__ */ __name((_stmt, err) => {
    const msg = String(err?.message || "").toLowerCase();
    const code = String(err?.code || "");
    return code === "42P07" || code === "42710" || code === "42701" || msg.includes("already exists");
  }, "defaultBenignCheck");
  const checkBenign = isBenignErr || defaultBenignCheck;
  for (const idxStmt of indexStatements) {
    try {
      await pool.query(idxStmt);
    } catch (idxErr) {
      if (checkBenign(idxStmt, idxErr)) {
        console.warn("[Migration Index Note]:", idxErr.message);
      } else {
        const summary = `${idxStmt.slice(0, 80)} -> ${idxErr?.message || idxErr}`;
        console.error("[Migration Index Error]:", summary);
        failures.push(summary);
      }
    }
  }
  return failures;
}
__name(applyMigrationIndexes, "applyMigrationIndexes");
var DEFAULT_BROADCAST_SETTING = {
  id: "broad_default",
  isActive: false,
  title: "Campus Safety & Verified Handshake Advisory",
  message: "All campus order pickups must be verified using the 4-digit Handshake OTP at daylight campus pickup spots.",
  tone: "info",
  createdAt: (/* @__PURE__ */ new Date()).toISOString(),
  author: "Shop It Safety Desk"
};
var DEFAULT_EMERGENCY_CONTROLS = {
  maintenanceMode: false,
  pauseNewOrders: false,
  pauseSellerSignups: false
};
var DEFAULT_FEE_SETTINGS_DB = {
  firstMonthPromoFree: false,
  tierLowFee: 200,
  tierMidFee: 500,
  tierHighPercentage: 0.05,
  minWithdrawal: 1e3
};
async function getPlatformSetting(key, fallback) {
  try {
    const res = await query("SELECT value FROM shopit_platform_settings WHERE key = $1", [key]);
    if (res.rows.length > 0 && res.rows[0].value && typeof res.rows[0].value === "object") {
      return { ...fallback, ...res.rows[0].value };
    }
  } catch (err) {
    console.warn(`[Platform Setting Read Warning (${key})]:`, err?.message || err);
  }
  return fallback;
}
__name(getPlatformSetting, "getPlatformSetting");
async function setPlatformSetting(key, value, updatedBy) {
  await query(
    `INSERT INTO shopit_platform_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
    [key, JSON.stringify(value), updatedBy]
  );
  return value;
}
__name(setPlatformSetting, "setPlatformSetting");
async function ensureBootstrapAdminFromEnv(poolArg) {
  const pool = poolArg || await getPool();
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminInitialPassword = (process.env.ADMIN_INITIAL_PASSWORD || "").trim();
  if (adminEmail && adminInitialPassword) {
    try {
      const existingAdmin = await pool.query(
        "SELECT id, email, role, sub_role, is_verified_email FROM shopit_users WHERE LOWER(email) = LOWER($1)",
        [adminEmail]
      );
      if (existingAdmin.rows.length === 0) {
        const passwordHash = hashPassword(adminInitialPassword);
        const adminId = "admin_" + crypto2.randomBytes(8).toString("hex");
        const alertId = "alert_u_" + adminId;
        await pool.query(
          `INSERT INTO shopit_users (
            id, email, name, display_name, profile_slug, password_hash, role, sub_role, is_verified_email, must_change_password, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            adminId,
            adminEmail,
            "Administrator",
            "Administrator",
            "administrator",
            passwordHash,
            "admin",
            "superadmin",
            true,
            true
            // Force password change at first login
          ]
        );
        await pool.query(
          `INSERT INTO shopit_admin_alerts (
            alert_key, id, alert_type, user_id, user_email, user_name, user_role, title, message, is_read, metadata, created_at
          ) VALUES ($1, $2, 'new_user', $3, $4, $5, 'admin', $6, $7, false, $8, NOW())
          ON CONFLICT (alert_key) DO NOTHING`,
          [
            `new_user_${adminId}`,
            alertId,
            adminId,
            adminEmail,
            "Administrator",
            "New admin registered",
            `Administrator (${adminEmail}) created as initial admin`,
            JSON.stringify({ source: "bootstrap" })
          ]
        );
        console.log(`[Admin Setup] Initial administrator account provisioned in PostgreSQL from ADMIN_EMAIL.`);
      } else {
        const row = existingAdmin.rows[0];
        if (row.role !== "admin") {
          console.warn(
            `[Admin Setup Security] Account for ADMIN_EMAIL (${adminEmail}) already exists with role="${row.role}". Refusing automatic promotion of existing user.`
          );
        }
      }
    } catch (adminErr) {
      console.error("[Admin Setup Error]:", adminErr.message);
      throw adminErr;
    }
  } else {
    console.log("[Admin Setup] Notice: ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD environment variables are not set in environment.");
  }
}
__name(ensureBootstrapAdminFromEnv, "ensureBootstrapAdminFromEnv");
async function getAllPlatformConfig() {
  const [broadcastAnnouncement, emergencyControls, feeSettings] = await Promise.all([
    getPlatformSetting("broadcast", DEFAULT_BROADCAST_SETTING),
    getPlatformSetting("emergency_controls", DEFAULT_EMERGENCY_CONTROLS),
    getPlatformSetting("fee_settings", DEFAULT_FEE_SETTINGS_DB)
  ]);
  return { broadcastAnnouncement, emergencyControls, feeSettings };
}
__name(getAllPlatformConfig, "getAllPlatformConfig");

// server/lib/payments.ts
import crypto4 from "crypto";

// server/lib/secrets.ts
import crypto3 from "crypto";
var HKDF_SALT = Buffer.from("shopit-hkdf-v1-salt", "utf8");
var cachedMasterHex = null;
var derivedKeyCache = /* @__PURE__ */ new Map();
function validateAppSecret() {
  const envVal = process.env.APP_SECRET;
  const raw = typeof envVal === "string" ? envVal.trim() : "";
  const isSet = raw.length > 0;
  const hasNonHex = isSet && /[^0-9a-fA-F]/.test(raw);
  const isLengthValid = raw.length >= 64;
  if (!isSet || !isLengthValid || hasNonHex) {
    throw new Error(
      `[SECURITY FATAL] APP_SECRET invalid: length ${raw.length} (need 64), non-hex: ${hasNonHex ? "yes" : "no"}, set: ${isSet ? "yes" : "no"}. Refusing to boot.`
    );
  }
  if (cachedMasterHex !== raw) {
    cachedMasterHex = raw;
    derivedKeyCache.clear();
  }
}
__name(validateAppSecret, "validateAppSecret");
function getMasterKeyBuffer() {
  validateAppSecret();
  return Buffer.from(cachedMasterHex, "hex");
}
__name(getMasterKeyBuffer, "getMasterKeyBuffer");
function deriveSubKey(label, lengthBytes = 32) {
  validateAppSecret();
  const cacheKey = `${label}:${lengthBytes}`;
  const existing = derivedKeyCache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const masterBuf = getMasterKeyBuffer();
  const info = Buffer.from(`shopit:${label}`, "utf8");
  const rawDerived = crypto3.hkdfSync("sha256", masterBuf, HKDF_SALT, info, lengthBytes);
  const keyBuf = Buffer.from(rawDerived);
  derivedKeyCache.set(cacheKey, keyBuf);
  return keyBuf;
}
__name(deriveSubKey, "deriveSubKey");

// shared/trustAndLegalCopy.ts
var OPERATOR_INFO = {
  brandName: "Shop It",
  operatorName: "TEEDS",
  operatedByLine: "Operated by TEEDS",
  copyrightLine: "\xA9 2026 Shop It. Made by TEEDS.",
  platformLabel: "Shop It Nigeria (TEEDS)",
  supportEmail: "shopitverified@gmail.com",
  supportSlaLine: "We aim to reply within 3 working days.",
  registrationDisclosure: "TEEDS is an independent student venture and is not registered with the Corporate Affairs Commission (CAC).",
  lawyerStatusComment: "Pending lawyer approval (TEEDS is not CAC-registered)."
};
var PAYMENT_HOLD_STATEMENT = "Payments are processed by Flutterwave. Shop It holds your payment until you confirm delivery.";
var PAYMENTS_DISABLED_STATEMENT = "Arrange directly with the seller";
var PAYMENTS_DISABLED_NOTICE = "Online payments are currently turned off. Arrange directly with the seller.";
var TRUST_COPY_BY_MODE = {
  enabled: {
    paymentsEnabled: true,
    topBarBadgeLong: "Shop It Order Payment Hold",
    topBarBadgeShort: "Order Protection",
    footerSummary: "Nigerian teen and youth marketplace where students and young makers sell handmade crafts.",
    footerTagline: "Nigerian Student & Youth Marketplace",
    footerStatusPill: "Flutterwave Checkout",
    footerOrdersLinkLabel: "Track Orders",
    footerProtectionLinkLabel: "Buyer Protection Policy",
    footerPrivacyLinkLabel: "Privacy Policy",
    productCardBadge: "Payment Hold",
    homeWelcomeBadge: "Nigerian Youth Marketplace",
    homeWelcomeSubtitle: "Marketplace for Nigerian teens and youth to buy and sell handmade beads, scent oils, crochet wear, fashion, and crafts.",
    homeTrustPrimary: PAYMENT_HOLD_STATEMENT,
    homeTrustSecondary: "Campus pickup or local delivery",
    pickupDirectoryTitle: "Campus Pickup Spots",
    pickupDirectorySubtitle: "Public, well-lit campus hubs for inspecting crafts before confirming delivery with your 4-digit Handshake PIN.",
    checkoutTitle: "Flutterwave Checkout",
    checkoutStatusBadge: "FLUTTERWAVE",
    checkoutSubtitle: "Card details handled by Flutterwave \xB7 Payment held until delivery confirmation",
    checkoutBoxTitle: "How Payment Hold Works",
    checkoutBoxPill: "5-Day Window",
    checkoutBoxBody: PAYMENT_HOLD_STATEMENT,
    checkoutChannelLabel: "Processed by Flutterwave",
    checkoutChannelFootnote: "Payments are processed by Flutterwave. Card details are not stored on Shop It servers.",
    checkoutFeeLabel: "Shop It Service Fee",
    checkoutTotalSubnote: "Includes Shop It service fee and delivery",
    checkoutFooterNote: PAYMENT_HOLD_STATEMENT,
    productInfoTitle: "How Payment Works",
    productInfoBody: `${PAYMENT_HOLD_STATEMENT} If an item does not match the listing or does not arrive, report a problem from your Orders page within 3 days for moderation review.`,
    productFeeLabel: "Shop It Service Fee",
    productSellerTrustFallback: "Trackable via Orders",
    productChatButtonLabel: "Ask Seller (In-App Chat)",
    cartProceedLabel: "Proceed to Checkout",
    cartDisabledBanner: PAYMENTS_DISABLED_NOTICE,
    cartBottomNote: PAYMENT_HOLD_STATEMENT,
    chatHeaderBadge: "In-App Order Chat",
    chatEmptyHint: 'Click "Ask Seller" on any item or shop to start an in-app conversation.',
    chatOfferTotalLabel: "Total Offer:",
    chatOfferCardHeader: "Preset Order Offer",
    chatOfferAcceptLabel: "Accept & Go to Checkout",
    chatQuickActionLine: "I would like to order through Shop It checkout",
    authTagline: "Marketplace for Nigerian teens and youth to buy and sell handmade crafts.",
    shareBadgeLabel: "Shop It Listing",
    shareFooterTagline: "Nigerian Youth Marketplace",
    quickListNoteTitle: "How Shop It Fees & Orders Work:",
    quickListNotePoints: [
      "Your seller payout is tracked in your Seller Wallet.",
      "Shop It adds a tiered service fee at checkout, shown clearly before payment.",
      "Packing photo upload protects makers if a buyer opens an order dispute."
    ],
    ordersHeaderTitle: "My Orders & Delivery Tracking",
    ordersHeaderSubtitle: "Track handmade orders, view packing photos, confirm delivery, or report an issue.",
    receiptTitle: "Shop It Order Pass",
    receiptStatusSettled: "Order Payment Released",
    receiptStatusActive: "Payment Held Pending Delivery",
    receiptSubSettled: "Order payment has been moved to the seller available balance.",
    receiptSubActive: PAYMENT_HOLD_STATEMENT,
    receiptTotalLabel: "Total Paid",
    receiptWatermark: "Shop It Order Record \xB7 Processed by Flutterwave",
    reportHeaderTitle: "Report an Order Problem",
    reportBannerText: "Opening a dispute pauses automatic release of the held payment until Admin Support reviews evidence from both sides.",
    reportRefundOptionLabel: "Request Refund",
    reportSubmitLabel: "Submit Problem Report"
  },
  disabled: {
    paymentsEnabled: false,
    topBarBadgeLong: "Shop It \xB7 Direct Arrangement",
    topBarBadgeShort: "Arrange Direct",
    footerSummary: "Nigerian teen and youth marketplace where students and young makers showcase handmade crafts.",
    footerTagline: "Nigerian Student & Youth Marketplace",
    footerStatusPill: "Arrange Directly with Seller",
    footerOrdersLinkLabel: "View Orders",
    footerProtectionLinkLabel: "Order & Dispute Policy",
    footerPrivacyLinkLabel: "Privacy Policy",
    productCardBadge: "Arrange Direct",
    homeWelcomeBadge: "Nigerian Youth Marketplace",
    homeWelcomeSubtitle: "Marketplace for Nigerian teens and youth to discover handmade beads, scent oils, crochet wear, fashion, and crafts.",
    homeTrustPrimary: PAYMENTS_DISABLED_STATEMENT,
    homeTrustSecondary: "Campus pickup or local meetup",
    pickupDirectoryTitle: "Campus Pickup Spots",
    pickupDirectorySubtitle: "Public, well-lit campus hubs where buyers and sellers can meet in person.",
    checkoutTitle: "Direct Order Arrangement",
    checkoutStatusBadge: "PAYMENTS OFF",
    checkoutSubtitle: "Online payments are currently turned off",
    checkoutBoxTitle: PAYMENTS_DISABLED_STATEMENT,
    checkoutBoxPill: "Payments Off",
    checkoutBoxBody: "Online payments are currently turned off on Shop It. Arrange directly with the seller via in-app chat.",
    checkoutChannelLabel: "Online checkout paused",
    checkoutChannelFootnote: "Online payments are currently turned off. Arrange directly with the seller.",
    checkoutFeeLabel: "Estimated Service Fee (when online checkout is enabled)",
    checkoutTotalSubnote: "Estimated breakdown for reference",
    checkoutFooterNote: PAYMENTS_DISABLED_STATEMENT,
    productInfoTitle: "How Ordering Works Right Now",
    productInfoBody: "Online payments are currently turned off. Message the seller in Shop It chat to arrange directly with the seller for pickup or delivery.",
    productFeeLabel: "Platform Service Fee (when online checkout is on)",
    productSellerTrustFallback: PAYMENTS_DISABLED_STATEMENT,
    productChatButtonLabel: "Message Seller to Arrange",
    cartProceedLabel: PAYMENTS_DISABLED_STATEMENT,
    cartDisabledBanner: PAYMENTS_DISABLED_NOTICE,
    cartBottomNote: PAYMENTS_DISABLED_NOTICE,
    chatHeaderBadge: "In-App Chat",
    chatEmptyHint: 'Click "Ask Seller" on any item or shop to message the maker directly.',
    chatOfferTotalLabel: "Total Discussed:",
    chatOfferCardHeader: "Preset Price Proposal",
    chatOfferAcceptLabel: PAYMENTS_DISABLED_STATEMENT,
    chatQuickActionLine: "Can we arrange directly for pickup or delivery?",
    authTagline: "Marketplace for Nigerian teens and youth to showcase and discover handmade crafts.",
    shareBadgeLabel: "Shop It Listing",
    shareFooterTagline: "Nigerian Youth Marketplace",
    quickListNoteTitle: "Listing & Direct Arrangement:",
    quickListNotePoints: [
      "Online checkout is currently turned off. Buyers will arrange directly with the seller.",
      "Your item stays visible in the marketplace with pickup and delivery details.",
      "Keep communication inside Shop It chat for safety."
    ],
    ordersHeaderTitle: "My Orders & Tracking",
    ordersHeaderSubtitle: "View existing order updates and tracking history.",
    receiptTitle: "Shop It Order Record",
    receiptStatusSettled: "Order Completed",
    receiptStatusActive: "Order In Progress",
    receiptSubSettled: "Order marked as completed.",
    receiptSubActive: "View current order tracking details below.",
    receiptTotalLabel: "Order Total",
    receiptWatermark: "Shop It Order Record",
    reportHeaderTitle: "Report an Order Problem",
    reportBannerText: "Submit evidence and details below so moderation can review your order.",
    reportRefundOptionLabel: "Request Refund",
    reportSubmitLabel: "Submit Problem Report"
  }
};
var EMAIL_TRUST_COPY = {
  signatureTeam: "The Shop It Team",
  signatureSubline: `${OPERATOR_INFO.operatedByLine} \xB7 Nigerian Youth & Student Artisanal Marketplace`,
  signatureHelpPrefix: `Support: ${OPERATOR_INFO.supportEmail} (${OPERATOR_INFO.supportSlaLine})`,
  signatureSecurityWarning: "Never share your codes. Shop It will never ask for your password or code.",
  orderPlacedBodyPrefix: "Payment of \u20A6{total} has been received. Payments are processed by Flutterwave. Shop It holds your payment until you confirm delivery.",
  welcomeBody: "Your Shop It account is ready."
};

// shared/transactionalEmails.ts
var EMAIL_SIGNATURE_TEXT = `${EMAIL_TRUST_COPY.signatureTeam} \xB7 ${OPERATOR_INFO.operatedByLine}.
${EMAIL_TRUST_COPY.signatureHelpPrefix}
${EMAIL_TRUST_COPY.signatureSecurityWarning}`;
var EMAIL_SIGNATURE_HTML = `
  <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; line-height: 1.6;">
    <p style="margin: 0; font-weight: 800; color: #1e293b;">${EMAIL_TRUST_COPY.signatureTeam}</p>
    <p style="margin: 3px 0 0; color: #64748b; font-size: 12px;">${EMAIL_TRUST_COPY.signatureSubline}</p>
    <p style="margin: 4px 0 0; color: #475569; font-size: 12px;">Need help? Email <a href="mailto:${OPERATOR_INFO.supportEmail}" style="color: #FF6B00; text-decoration: underline;">${OPERATOR_INFO.supportEmail}</a> (${OPERATOR_INFO.supportSlaLine})</p>
    <p style="margin: 6px 0 0; color: #dc2626; font-size: 11px; font-weight: 700;">${EMAIL_TRUST_COPY.signatureSecurityWarning}</p>
  </div>
`;
function escapeEmailHtml(val) {
  return String(val ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
__name(escapeEmailHtml, "escapeEmailHtml");
function renderTransactionalEmail(template, data) {
  const rawCode = String(data.code || "").trim();
  const rawOrderId = String(data.order_id || data.orderId || "").trim();
  const total = data.total !== void 0 ? Number(data.total).toLocaleString() : "0";
  const amount = data.amount !== void 0 ? Number(data.amount).toLocaleString() : "0";
  const rawBankName = String(data.bank_name || data.bankName || "Nigerian Bank Account").trim();
  const rawLast4 = String(data.last4 || "\u2022\u2022\u2022\u2022").trim();
  const rawItem = String(data.item || "your item").trim();
  const appUrl = String(data.appUrl || "https://shopitng.vercel.app").replace(/\/$/, "");
  const rawDecision = String(data.decision || "Refund processed").trim();
  const rawReason = String(data.reason || "Document was unreadable or selfie could not be verified").trim();
  const code = escapeEmailHtml(rawCode);
  const orderId = escapeEmailHtml(rawOrderId);
  const bankName = escapeEmailHtml(rawBankName);
  const last4 = escapeEmailHtml(rawLast4);
  const item = escapeEmailHtml(rawItem);
  const decision = escapeEmailHtml(rawDecision);
  const reason = escapeEmailHtml(rawReason);
  let subject = "";
  let bodyText = "";
  let bodyHtmlContent = "";
  switch (template) {
    case "signup_code":
      subject = "Your Shop It verification code";
      bodyText = `Your code is ${code}. It expires in 10 minutes. Never share it.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Your code is <strong style="font-size: 22px; color: #0f172a; letter-spacing: 4px; font-family: monospace; display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1;">${code}</strong>. It expires in 10 minutes. Never share it.
        </p>
      `;
      break;
    case "email_change":
      subject = "Confirm your new Shop It email address";
      bodyText = `Your code to switch your Shop It account email is ${code}. It expires in 10 minutes. Never share it.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          You asked to update the email address on your Shop It account. Enter code <strong style="font-size: 22px; color: #0f172a; letter-spacing: 4px; font-family: monospace; display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1;">${code}</strong>. It expires in 10 minutes.
        </p>
        <p style="margin: 0; font-size: 14px; color: #dc2626;">If you did not request this change, secure your password immediately.</p>
      `;
      break;
    case "new_device_login":
      subject = "Confirm your login on Shop It";
      bodyText = `Someone is logging in on a new device. Code: ${code}. If this wasn't you, change your password now.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Someone is logging in on a new device. Code: <strong style="font-size: 22px; color: #0f172a; letter-spacing: 4px; font-family: monospace; display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1;">${code}</strong>.
        </p>
        <p style="margin: 0; font-size: 14px; color: #dc2626;">If this wasn't you, change your password now.</p>
      `;
      break;
    case "password_reset":
      subject = "Your Shop It password reset code";
      bodyText = `We received a request to reset the password for your Shop It account.

Your 6-digit reset code is: ${code}
(Expires in 10 minutes \xB7 3 attempts max)

Enter this 6-digit code in the app to reset your password. Never share this code with anyone.

If you didn't ask to reset your password, you can safely ignore this email. Your password will remain unchanged.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          We received a request to reset the password for your Shop It account. Enter the 6-digit code below in the app to choose a new password:
        </p>

        <div style="text-align: center; margin: 24px 0; background-color: #fff7ed; border: 2px dashed #FF6B00; border-radius: 14px; padding: 20px 16px;">
          <span style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #c2410c; margin-bottom: 8px;">
            Your 6-Digit Password Reset Code
          </span>
          <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace; color: #111111; display: inline-block;">
            ${code}
          </div>
          <span style="display: block; font-size: 12px; color: #78350f; font-weight: 600; margin-top: 8px;">
            \u23F1 Valid for 10 minutes \xB7 3 wrong attempts max \xB7 Never share this code
          </span>
        </div>

        <p style="margin: 20px 0 0; font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          If you didn't ask to reset your password, you can safely ignore this email. Your account is still secure.
        </p>
      `;
      break;
    case "withdrawal_code":
      subject = "Confirm your withdrawal";
      bodyText = `Withdraw \u20A6${amount} to ${bankName} ending ${last4}. Code: ${code}.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Withdraw <strong>\u20A6${amount}</strong> to <strong>${bankName}</strong> ending <strong>${last4}</strong>. Code: <strong style="font-size: 20px; color: #0f172a; letter-spacing: 3px; font-family: monospace; padding: 3px 8px; background: #f1f5f9; border-radius: 6px;">${code}</strong>.
        </p>
      `;
      break;
    case "new_payout_account_code":
      subject = "Confirm your new payout account";
      bodyText = `Adding ${bankName} ending ${last4}. Code: ${code}. You can withdraw to it after 24 hours.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Adding <strong>${bankName}</strong> ending <strong>${last4}</strong>. Code: <strong style="font-size: 20px; color: #0f172a; letter-spacing: 3px; font-family: monospace; padding: 3px 8px; background: #f1f5f9; border-radius: 6px;">${code}</strong>. You can withdraw to it after 24 hours.
        </p>
      `;
      break;
    case "order_placed_buyer": {
      const orderPlacedMsg = EMAIL_TRUST_COPY.orderPlacedBodyPrefix.replace("{total}", total);
      subject = `We got your order #${orderId}`;
      bodyText = `${orderPlacedMsg} Track your order: ${appUrl}/orders?track=${orderId}`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Payment of <strong>\u20A6${total}</strong> received. Payments are processed by Flutterwave. Shop It holds your payment until you confirm delivery.
        </p>
        <p style="margin: 16px 0;">
          <a href="${appUrl}/orders?track=${orderId}" style="display: inline-block; background: #111111; color: #9FE870; font-weight: 700; font-size: 13px; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #FF6B00;">
            Track Order Live &rarr;
          </a>
        </p>
      `;
      break;
    }
    case "new_order_seller":
      subject = `New order #${orderId}`;
      bodyText = `You have a new order for ${item}. Pack it, upload a photo, and mark it shipped.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          You have a new order for <strong>${item}</strong>. Pack it, upload a photo, and mark it shipped.
        </p>
      `;
      break;
    case "order_shipped_buyer":
      subject = `Your order #${orderId} is on the way`;
      bodyText = `When it arrives, tap "Item received" so the seller gets paid. Track your shipment: ${appUrl}/orders?track=${orderId}`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          When it arrives, tap "Item received" so the seller gets paid.
        </p>
        <p style="margin: 16px 0;">
          <a href="${appUrl}/orders?track=${orderId}" style="display: inline-block; background: #111111; color: #9FE870; font-weight: 700; font-size: 13px; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #FF6B00;">
            View Tracking Timeline &rarr;
          </a>
        </p>
      `;
      break;
    case "item_received_seller":
      subject = `Payment released for order #${orderId}`;
      bodyText = `\u20A6${amount} is now in your available balance.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          <strong>\u20A6${amount}</strong> is now in your available balance.
        </p>
      `;
      break;
    case "auto_release_reminder":
      subject = `Did your order #${orderId} arrive?`;
      bodyText = `Confirm it, or the money is released to the seller in 2 days. Not happy? Report a problem.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Confirm it, or the money is released to the seller in 2 days. Not happy? Report a problem.
        </p>
      `;
      break;
    case "dispute_opened":
      subject = `Problem reported on order #${orderId}`;
      bodyText = `The money is on hold. Please upload photos or details.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          The money is on hold. Please upload photos or details.
        </p>
      `;
      break;
    case "dispute_resolved":
      subject = `Update on order #${orderId}`;
      bodyText = `Decision: ${decision}.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Decision: <strong>${decision}</strong>.
        </p>
      `;
      break;
    case "seller_verified":
      subject = `You're verified on Shop It`;
      bodyText = `You can now list products and withdraw earnings.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          You can now list products and withdraw earnings.
        </p>
      `;
      break;
    case "verification_not_approved":
      subject = `We couldn't verify your ID`;
      bodyText = `Reason: ${reason}. Please upload a clearer ID and selfie.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Reason: <strong>${reason}</strong>. Please upload a clearer ID and selfie.
        </p>
      `;
      break;
    case "welcome":
    default:
      subject = "Welcome to Shop It";
      bodyText = EMAIL_TRUST_COPY.welcomeBody;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          ${EMAIL_TRUST_COPY.welcomeBody}
        </p>
      `;
      break;
  }
  const fullText = `${bodyText}

${EMAIL_SIGNATURE_TEXT}`;
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 32px 16px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; background-color: #FF6B00; color: #ffffff; font-weight: 800; font-size: 12px; letter-spacing: 0.5px;">Shop It</span>
      <h2 style="color: #0f172a; font-size: 19px; font-weight: 800; margin: 12px 0 0;">${subject}</h2>
    </div>

    ${bodyHtmlContent}

    ${EMAIL_SIGNATURE_HTML}
  </div>
</body>
</html>`;
  return {
    subject,
    text: fullText,
    html: fullHtml
  };
}
__name(renderTransactionalEmail, "renderTransactionalEmail");

// server/lib/payments.ts
function nairaToKobo(naira) {
  const num = typeof naira === "string" ? parseFloat(naira) : naira;
  return Math.round((Number.isFinite(num) ? num : 0) * 100);
}
__name(nairaToKobo, "nairaToKobo");
function koboToNaira(kobo) {
  const num = typeof kobo === "string" ? parseInt(kobo, 10) : kobo;
  return (Number.isFinite(num) ? num : 0) / 100;
}
__name(koboToNaira, "koboToNaira");
function calculateConfiguredServiceFeeKobo(sellerPriceKobo, feeSettings) {
  const safeKobo = Math.max(0, Math.round(Number(sellerPriceKobo) || 0));
  if (feeSettings?.firstMonthPromoFree) {
    return 0;
  }
  const lowKobo = feeSettings?.tierLowFee !== void 0 ? Math.max(0, nairaToKobo(feeSettings.tierLowFee)) : 2e4;
  const midKobo = feeSettings?.tierMidFee !== void 0 ? Math.max(0, nairaToKobo(feeSettings.tierMidFee)) : 5e4;
  const highPct = feeSettings?.tierHighPercentage !== void 0 ? Math.max(0, Math.min(0.25, Number(feeSettings.tierHighPercentage))) : 0.05;
  if (safeKobo < 2e5) return lowKobo;
  if (safeKobo <= 1e6) return midKobo;
  return Math.round(safeKobo * highPct / 5e3) * 5e3;
}
__name(calculateConfiguredServiceFeeKobo, "calculateConfiguredServiceFeeKobo");
var IS_PROD = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
function getDocAesKey() {
  return deriveSubKey("doc-encryption", 32);
}
__name(getDocAesKey, "getDocAesKey");
function encryptSensitiveData(plaintext) {
  const key = getDocAesKey();
  const iv = crypto4.randomBytes(12);
  const cipher = crypto4.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}
__name(encryptSensitiveData, "encryptSensitiveData");
function decryptSensitiveData(ciphertext) {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format.");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = getDocAesKey();
  const decipher = crypto4.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
__name(decryptSensitiveData, "decryptSensitiveData");
async function sendBrevoDirect(to, subject, text, html, name) {
  const apiKey = (process.env.BREVO_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey || apiKey.startsWith("xkeysib-...")) {
    if (!IS_PROD) {
      console.log(`[Brevo Dev Log] To: ${to} | Subject: ${subject}`);
    } else {
      console.error("[Brevo Critical] BREVO_API_KEY missing in production.");
    }
    return false;
  }
  try {
    const emailFrom = (process.env.EMAIL_FROM || "shopitverified@gmail.com").trim().replace(/^["']|["']$/g, "");
    const emailFromName = (process.env.EMAIL_FROM_NAME || "Shop It").trim().replace(/^["']|["']$/g, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8e3);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        sender: { name: emailFromName, email: emailFrom },
        to: [{ email: to, name: name || to.split("@")[0] }],
        subject,
        textContent: text,
        htmlContent: html
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.warn("[Brevo Direct Warning]:", err.message);
    return false;
  }
}
__name(sendBrevoDirect, "sendBrevoDirect");
function escapeHtmlSafe(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
__name(escapeHtmlSafe, "escapeHtmlSafe");
async function sendAdminAlert(key, subject, htmlDetails) {
  try {
    const ins = await query(
      "INSERT INTO shopit_admin_alerts (alert_key, created_at) VALUES ($1, NOW()) ON CONFLICT (alert_key) DO NOTHING RETURNING alert_key",
      [key]
    );
    if (ins.rows.length === 0) return;
  } catch {
  }
  const safeSubject = escapeHtmlSafe(subject);
  const adminEmail = (process.env.ADMIN_ALERT_EMAIL || "shopitverified@gmail.com").trim();
  try {
    await sendBrevoDirect(
      adminEmail,
      `[Shop It Alert] ${subject}`,
      subject,
      `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="margin-bottom: 16px;">
          <span style="background: #FF6B00; color: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">Admin Notification</span>
          <h2 style="color: #0f172a; margin: 8px 0 0; font-size: 18px;">${safeSubject}</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 14px; line-height: 1.6;">
          ${htmlDetails}
        </div>
        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
          Shop It Operations &amp; Safety Alert \xB7 Sent to <strong>${escapeHtmlSafe(adminEmail)}</strong>
        </div>
      </div>`,
      "Shop It Admin"
    );
  } catch (err) {
    console.warn("[Admin Alert Warning]", err.message);
  }
}
__name(sendAdminAlert, "sendAdminAlert");
async function restoreOrderStockInTx(client, order) {
  if (!order.stock_reserved) return;
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    if (item.productId) {
      await client.query(
        "UPDATE shopit_products SET stock = stock + $1, is_sold_out = false, updated_at = NOW() WHERE id = $2",
        [qty, item.productId]
      );
    }
  }
  await client.query("UPDATE shopit_orders SET stock_reserved = false, updated_at = NOW() WHERE id = $1", [order.id]);
}
__name(restoreOrderStockInTx, "restoreOrderStockInTx");
async function expireStalePendingOrders(batchLimit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(batchLimit)));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
  const result = await withTransaction(async (client) => {
    const staleRes = await client.query(
      `SELECT id, status, items, stock_reserved, expires_at, created_at
       FROM shopit_orders
       WHERE status = 'pending_payment'
         AND (
           (expires_at IS NOT NULL AND expires_at <= NOW())
           OR (expires_at IS NULL AND created_at < NOW() - INTERVAL '60 minutes')
         )
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE`,
      [safeLimit]
    );
    const expiredIds = [];
    for (const row of staleRes.rows) {
      await restoreOrderStockInTx(client, row);
      await client.query(
        `UPDATE shopit_orders
         SET status = 'cancelled',
             stock_reserved = false,
             notes = COALESCE(notes || ' | ', '') || 'Expired without completed payment',
             updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );
      await client.query(
        `UPDATE shopit_payments
         SET status = 'expired', updated_at = NOW()
         WHERE order_id = $1 AND status IN ('pending', 'pending_payment')`,
        [row.id]
      );
      await client.query(
        `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
         VALUES ($1, $2, 'pending_payment', 'cancelled', 'expire_orders_cron', 'Pending order expired (60m window) and reserved stock restored.', NOW())`,
        [`osh_exp_${Date.now()}_${crypto4.randomBytes(3).toString("hex")}`, row.id]
      );
      expiredIds.push(row.id);
    }
    const purgedRes = await client.query(
      `DELETE FROM shopit_verification_documents
       WHERE created_at < $1
         AND seller_id IN (
           SELECT seller_id FROM shopit_verifications
           WHERE status IN ('verified', 'approved', 'rejected') AND submitted_at < $1
         )
       RETURNING id`,
      [thirtyDaysAgo]
    );
    await client.query(
      `UPDATE shopit_verifications
       SET document_url = '[Purged after 30 days]',
           selfie_url = '[Purged after 30 days]',
           updated_at = NOW()
       WHERE submitted_at < $1
         AND status IN ('verified', 'approved', 'rejected')
         AND (
           COALESCE(document_url, '') <> '[Purged after 30 days]'
           OR COALESCE(selfie_url, '') <> '[Purged after 30 days]'
         )`,
      [thirtyDaysAgo]
    );
    return {
      expiredCount: expiredIds.length,
      orderIds: expiredIds,
      purgedDocsCount: purgedRes.rowCount || 0
    };
  });
  return result;
}
__name(expireStalePendingOrders, "expireStalePendingOrders");
async function runLazyPendingOrderExpiry() {
  try {
    const dueCheck = await query(
      `SELECT id
       FROM shopit_orders
       WHERE status = 'pending_payment'
         AND (
           (expires_at IS NOT NULL AND expires_at <= NOW())
           OR (expires_at IS NULL AND created_at < NOW() - INTERVAL '60 minutes')
         )
       LIMIT 1`
    );
    if (dueCheck.rows.length === 0) return 0;
    const res = await expireStalePendingOrders(50);
    return res.expiredCount;
  } catch {
    return 0;
  }
}
__name(runLazyPendingOrderExpiry, "runLazyPendingOrderExpiry");
async function commitPaidOrderTransaction(params) {
  const cleanCurrency = String(params.currency || "").trim().toUpperCase();
  if (cleanCurrency !== "NGN") {
    return { found: true, committed: false, alreadyPaid: false, currencyMismatch: true };
  }
  const lateAlertHolder = {
    alert: null
  };
  const txResult = await withTransaction(async (client) => {
    const orderRes = await client.query(
      "SELECT * FROM shopit_orders WHERE payment_reference = $1 FOR UPDATE",
      [params.reference]
    );
    if (orderRes.rows.length === 0) {
      return { found: false, committed: false, alreadyPaid: false };
    }
    const order = orderRes.rows[0];
    const paidStatuses = ["paid", "packed", "shipped", "delivered", "completed"];
    if (paidStatuses.includes(order.status)) {
      if (params.webhookReceived || params.gatewayData?.flwTransactionId) {
        const payRowRes = await client.query("SELECT data FROM shopit_payments WHERE reference = $1", [params.reference]);
        const rawExisting = payRowRes.rows[0]?.data;
        let existingObj = {};
        if (rawExisting) {
          existingObj = typeof rawExisting === "string" ? (() => {
            try {
              return JSON.parse(rawExisting);
            } catch {
              return {};
            }
          })() : typeof rawExisting === "object" ? rawExisting : {};
        }
        const mergedData = { ...existingObj, ...params.gatewayData || {} };
        await client.query(
          `UPDATE shopit_payments
           SET webhook_received = COALESCE(webhook_received, false) OR $1,
               data = $2,
               updated_at = NOW()
           WHERE reference = $3`,
          [params.webhookReceived, JSON.stringify(mergedData), params.reference]
        );
      }
      return { found: true, committed: false, alreadyPaid: true, order };
    }
    const expectedKobo = Number(order.grand_total_kobo || 0);
    if (Number(params.confirmedAmountKobo) < expectedKobo) {
      return {
        found: true,
        committed: false,
        alreadyPaid: false,
        amountMismatch: true,
        order
      };
    }
    const isExpired = order.status === "cancelled" || order.status === "pending_payment" && order.expires_at && new Date(order.expires_at).getTime() <= Date.now();
    if (isExpired) {
      if (order.status === "pending_payment") {
        await restoreOrderStockInTx(client, order);
        await client.query(
          `UPDATE shopit_orders
           SET status = 'cancelled',
               stock_reserved = false,
               notes = COALESCE(notes || ' | ', '') || 'Late payment received after expiry',
               updated_at = NOW()
           WHERE id = $1`,
          [order.id]
        );
        await client.query(
          `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
           VALUES ($1, $2, 'pending_payment', 'cancelled', $3, 'Late payment received after expiry; stock restored and flagged for refund.', NOW())`,
          [`osh_late_${Date.now()}_${crypto4.randomBytes(3).toString("hex")}`, order.id, params.source]
        );
      }
      await client.query(
        `INSERT INTO shopit_payments (
          reference, order_id, amount_kobo, currency, channel, status, webhook_received, customer_email, data, updated_at
        ) VALUES ($1, $2, $3, 'NGN', $4, 'late_after_expiry', $5, $6, $7, NOW())
        ON CONFLICT (reference) DO UPDATE SET
          status = 'late_after_expiry',
          webhook_received = COALESCE(shopit_payments.webhook_received, false) OR $5,
          data = $7,
          updated_at = NOW()`,
        [
          params.reference,
          order.id,
          params.confirmedAmountKobo,
          params.channel || "online",
          params.webhookReceived,
          params.customerEmail || order.buyer_email || "",
          JSON.stringify(params.gatewayData || {})
        ]
      );
      lateAlertHolder.alert = {
        orderId: order.id,
        amountNaira: koboToNaira(params.confirmedAmountKobo),
        txRef: params.reference,
        flwId: params.gatewayData?.flwTransactionId || params.gatewayData?.gatewayId || "N/A"
      };
      return {
        found: true,
        committed: false,
        alreadyPaid: false,
        expired: true,
        invalidState: "cancelled",
        order
      };
    }
    if (order.status !== "pending_payment") {
      return {
        found: true,
        committed: false,
        alreadyPaid: false,
        invalidState: order.status,
        order
      };
    }
    await client.query(
      `UPDATE shopit_orders
       SET status = 'paid',
           stock_reserved = true,
           paid_at = COALESCE(paid_at, NOW()),
           auto_release_at = NOW() + INTERVAL '5 days',
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending_payment'`,
      [order.id]
    );
    await client.query(
      `INSERT INTO shopit_order_status_history (
        id, order_id, previous_status, new_status, changed_by, notes, created_at
      ) VALUES ($1, $2, 'pending_payment', 'paid', $3, 'Payment verified via Flutterwave into 5-day escrow', NOW())`,
      [`osh_${Date.now()}_${crypto4.randomBytes(3).toString("hex")}`, order.id, params.source]
    );
    const items = Array.isArray(order.items) ? order.items : [];
    const sellerTotalsKobo = {};
    for (const item of items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      if (item.productId && !order.stock_reserved) {
        const pRes = await client.query("SELECT stock FROM shopit_products WHERE id = $1 FOR UPDATE", [item.productId]);
        if (pRes.rows.length > 0) {
          const nextStock = Math.max(0, parseInt(String(pRes.rows[0].stock || "0"), 10) - qty);
          await client.query(
            "UPDATE shopit_products SET stock = $1, is_sold_out = $2, updated_at = NOW() WHERE id = $3",
            [nextStock, nextStock <= 0, item.productId]
          );
        }
      }
      if (item.sellerId) {
        const itemTotalKobo = (Number(item.sellerPriceKobo) || Math.round(Number(item.sellerPrice || 0) * 100)) * qty;
        sellerTotalsKobo[item.sellerId] = (sellerTotalsKobo[item.sellerId] || 0) + itemTotalKobo;
      }
    }
    if (order.coupon_code) {
      await client.query(
        "UPDATE shopit_coupons SET current_uses = current_uses + 1 WHERE code = $1",
        [String(order.coupon_code).trim().toUpperCase()]
      );
    }
    await client.query(
      `INSERT INTO shopit_payments (
        reference, order_id, amount_kobo, currency, channel, status, webhook_received, customer_email, data, updated_at
      ) VALUES ($1, $2, $3, 'NGN', $4, 'paid', $5, $6, $7, NOW())
      ON CONFLICT (reference) DO UPDATE SET
        status = 'paid',
        webhook_received = COALESCE(shopit_payments.webhook_received, false) OR $5,
        channel = COALESCE($4, shopit_payments.channel),
        data = $7,
        updated_at = NOW()`,
      [
        params.reference,
        order.id,
        expectedKobo,
        params.channel || "online",
        params.webhookReceived,
        params.customerEmail || order.buyer_email || "",
        JSON.stringify(params.gatewayData || {})
      ]
    );
    for (const [sId, sellerEarningsKobo] of Object.entries(sellerTotalsKobo)) {
      await client.query(
        `INSERT INTO shopit_wallets (
          seller_id, is_frozen,
          pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at
        ) VALUES ($1, false, 0, 0, 0, NOW(), NOW())
        ON CONFLICT (seller_id) DO NOTHING`,
        [sId]
      );
      const wRes = await client.query(
        "SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
        [sId]
      );
      const currentPendingKobo = parseInt(wRes.rows[0]?.pending_balance_kobo || "0", 10);
      const newPendingKobo = currentPendingKobo + sellerEarningsKobo;
      const idempotencyKey = `sale_pending:${order.id}:${sId}`;
      const ledgerIns = await client.query(
        `INSERT INTO shopit_ledger_entries (
          id, wallet_id, order_id, type, balance_type, status,
          amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
        ) VALUES (
          $1, $2, $3, 'sale_pending', 'pending', 'held',
          $4, 0, $5, $6, $7, $8, NOW()
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id`,
        [
          `LEDGER-PEND-${order.id}-${sId.slice(-6)}`,
          sId,
          order.id,
          sellerEarningsKobo,
          newPendingKobo,
          `Escrow holding for Order #${order.id}`,
          params.reference,
          idempotencyKey
        ]
      );
      if (ledgerIns.rows.length > 0) {
        await client.query(
          `UPDATE shopit_wallets
           SET pending_balance_kobo = $1,
               updated_at = NOW()
           WHERE seller_id = $2`,
          [newPendingKobo, sId]
        );
      }
    }
    if (order.buyer_id) {
      await client.query("DELETE FROM shopit_carts WHERE user_id = $1", [order.buyer_id]);
    }
    return { found: true, committed: true, alreadyPaid: false, order };
  });
  if (lateAlertHolder.alert) {
    const alertInfo = lateAlertHolder.alert;
    await sendAdminAlert(
      `late_payment_${alertInfo.txRef}`,
      `Late Payment Received for Expired Order #${alertInfo.orderId}`,
      `Flutterwave confirmed a payment after the checkout order expired/cancelled.<br/>
       Order ID: <strong>#${escapeHtmlSafe(alertInfo.orderId)}</strong><br/>
       tx_ref: <code>${escapeHtmlSafe(alertInfo.txRef)}</code><br/>
       Flutterwave TX ID: <code>${escapeHtmlSafe(alertInfo.flwId)}</code><br/>
       Amount: <strong>\u20A6${alertInfo.amountNaira.toLocaleString()}</strong><br/>
       Action Required: Issue refund to buyer via Admin Panel.`
    ).catch(() => {
    });
  }
  if (txResult.committed && txResult.order) {
    const order = txResult.order;
    const items = Array.isArray(order.items) ? order.items : [];
    const sellerIds = Array.from(new Set(items.map((i) => i.sellerId).filter(Boolean)));
    try {
      const emailTasks = [];
      const buyerEmail = params.customerEmail || order.buyer_email;
      if (buyerEmail) {
        const buyerMail = renderTransactionalEmail("order_placed_buyer", {
          name: order.buyer_name || "Customer",
          order_id: order.id,
          total: koboToNaira(order.grand_total_kobo || 0)
        });
        emailTasks.push(sendBrevoDirect(buyerEmail, buyerMail.subject, buyerMail.text, buyerMail.html, order.buyer_name));
      }
      for (const sId of sellerIds) {
        const sRes = await query("SELECT email, shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1", [sId]);
        const sellerEmail = sRes.rows[0]?.email;
        if (sellerEmail) {
          const sMail = renderTransactionalEmail("new_order_seller", {
            name: sRes.rows[0]?.shop_name || "Artisan",
            order_id: order.id,
            item: items.find((i) => i.sellerId === sId)?.title || "Craft item"
          });
          emailTasks.push(sendBrevoDirect(sellerEmail, sMail.subject, sMail.text, sMail.html, sRes.rows[0]?.shop_name));
        }
      }
      const settledKobo = Number(order.grand_total_kobo) || Number(params.confirmedAmountKobo);
      if (settledKobo >= 5e6) {
        emailTasks.push(
          sendAdminAlert(
            `high_order_${params.reference}`,
            `High-Value Order Confirmed (\u20A6${koboToNaira(settledKobo).toLocaleString()})`,
            `An order above \u20A650,000 has been verified and committed to Escrow.<br/>
             Order ID: <strong>#${escapeHtmlSafe(order.id)}</strong><br/>
             Amount: <strong>\u20A6${koboToNaira(settledKobo).toLocaleString()}</strong><br/>
             Payment Channel: <strong>${escapeHtmlSafe(params.channel || "online")}</strong>`
          )
        );
      }
      await Promise.allSettled(emailTasks);
    } catch {
    }
  }
  return txResult;
}
__name(commitPaidOrderTransaction, "commitPaidOrderTransaction");
async function processUnshippedOrders(batchLimit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(batchLimit)));
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3).toISOString();
  const remindedOrderIds = [];
  const refundedOrderIds = [];
  try {
    const remindCandidates = await query(
      `SELECT o.id
       FROM shopit_orders o
       LEFT JOIN shopit_disputes d ON d.order_id = o.id AND d.status IN ('open', 'investigating')
       WHERE o.status IN ('paid', 'packed')
         AND COALESCE(o.admin_hold, false) = false
         AND o.unshipped_reminder_sent_at IS NULL
         AND COALESCE(o.paid_at, o.created_at) <= $1
         AND COALESCE(o.paid_at, o.created_at) > $2
         AND d.id IS NULL
       ORDER BY COALESCE(o.paid_at, o.created_at) ASC
       LIMIT $3`,
      [threeDaysAgo, fiveDaysAgo, safeLimit]
    );
    for (const row of remindCandidates.rows) {
      const orderToRemind = await withTransaction(async (client) => {
        const oRes = await client.query("SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE", [row.id]);
        if (oRes.rows.length === 0) return null;
        const ord = oRes.rows[0];
        if (!["paid", "packed"].includes(ord.status) || ord.admin_hold || ord.unshipped_reminder_sent_at) {
          return null;
        }
        const disp = await client.query(
          `SELECT id FROM shopit_disputes WHERE order_id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
          [ord.id]
        );
        if (disp.rows.length > 0) return null;
        await client.query(
          `UPDATE shopit_orders SET unshipped_reminder_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [ord.id]
        );
        return ord;
      });
      if (orderToRemind) {
        remindedOrderIds.push(orderToRemind.id);
        const items = Array.isArray(orderToRemind.items) ? orderToRemind.items : [];
        const sellerIds = Array.from(new Set(items.map((i) => i.sellerId).filter(Boolean)));
        for (const sId of sellerIds) {
          try {
            const sRes = await query("SELECT user_id, email, shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1", [sId]);
            const targetUserId = sRes.rows[0]?.user_id || sId;
            const sellerEmail = sRes.rows[0]?.email;
            const shopName = sRes.rows[0]?.shop_name || "Artisan";
            await query(
              `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
               VALUES ($1, $2, $3, $4, 'warning', false, '/dashboard', NOW())`,
              [
                `notif_unshipped_${Date.now()}_${crypto4.randomBytes(2).toString("hex")}`,
                targetUserId,
                "Shipping Reminder (Day 3)",
                `Order #${orderToRemind.id} has been awaiting dispatch for 3 days. Please ship within 48 hours or it will be auto-cancelled and refunded to the buyer on Day 5.`
              ]
            );
            if (sellerEmail) {
              const subj = `Action Required: Ship Order #${orderToRemind.id} within 48 hours`;
              const txt = `Hi ${shopName}, Order #${orderToRemind.id} was paid 3 days ago and has not been marked as shipped. Please upload your packing photo and mark it shipped within 48 hours, or it will be automatically cancelled and refunded to the buyer on Day 5.`;
              await sendBrevoDirect(
                sellerEmail,
                subj,
                txt,
                `<p>Hi <strong>${escapeHtmlSafe(shopName)}</strong>,</p><p>Order <strong>#${escapeHtmlSafe(orderToRemind.id)}</strong> was paid 3 days ago and has not yet been marked as shipped.</p><p>Please upload your packing photo and dispatch within 48 hours, or the order will be automatically cancelled and refunded in full to the buyer on Day 5.</p>`,
                shopName
              );
            }
          } catch {
          }
        }
      }
    }
    const refundCandidates = await query(
      `SELECT o.*
       FROM shopit_orders o
       LEFT JOIN shopit_disputes d ON d.order_id = o.id AND d.status IN ('open', 'investigating')
       WHERE o.status IN ('paid', 'packed')
         AND COALESCE(o.admin_hold, false) = false
         AND COALESCE(o.paid_at, o.created_at) <= $1
         AND d.id IS NULL
       ORDER BY COALESCE(o.paid_at, o.created_at) ASC
       LIMIT $2`,
      [fiveDaysAgo, safeLimit]
    );
    const flwSecret = (process.env.FLW_SECRET_KEY || "").trim().replace(/^["']|["']$/g, "");
    const paymentsEnabled = process.env.PAYMENTS_ENABLED === "true";
    for (const candidate of refundCandidates.rows) {
      if (!paymentsEnabled || !flwSecret) {
        console.warn(`[Unshipped Cron] Skipped Day-5 auto-refund for ${candidate.id}: payments or FLW_SECRET_KEY disabled.`);
        continue;
      }
      const payRes = await query("SELECT * FROM shopit_payments WHERE reference = $1 OR order_id = $2 LIMIT 1", [
        candidate.payment_reference,
        candidate.id
      ]);
      const paymentRow = payRes.rows[0];
      let payData = {};
      if (paymentRow?.data) {
        payData = typeof paymentRow.data === "string" ? (() => {
          try {
            return JSON.parse(paymentRow.data);
          } catch {
            return {};
          }
        })() : paymentRow.data;
      }
      const flwTxId = payData?.flwTransactionId || payData?.id;
      if (!flwTxId) {
        console.warn(`[Unshipped Cron] Missing Flutterwave transaction ID for order ${candidate.id}; alerting admin.`);
        await sendAdminAlert(
          `unshipped_missing_tx_${candidate.id}`,
          `Unshipped Order #${candidate.id} Missing Flutterwave TX ID`,
          `Order #${escapeHtmlSafe(candidate.id)} exceeded 5 days unshipped but has no stored Flutterwave transaction ID for automatic refund.`
        ).catch(() => {
        });
        continue;
      }
      const refundNaira = koboToNaira(candidate.grand_total_kobo || 0);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12e3);
      let flwOk = false;
      let flwRefundData = {};
      try {
        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(flwTxId))}/refund`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${flwSecret}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: refundNaira,
              comments: `Auto-refund: Order #${candidate.id} not shipped within 5 days`
            }),
            signal: controller.signal
          }
        );
        flwRefundData = await flwRes.json().catch(() => ({}));
        flwOk = flwRes.ok && flwRefundData?.status === "success";
      } catch (err) {
        console.warn(`[Unshipped Cron] Flutterwave refund timeout/error for ${candidate.id}:`, err.message);
      } finally {
        clearTimeout(timeout);
      }
      if (!flwOk) {
        await sendAdminAlert(
          `unshipped_flw_fail_${candidate.id}`,
          `Auto-Refund Failed for Unshipped Order #${candidate.id}`,
          `Order #${escapeHtmlSafe(candidate.id)} exceeded 5 days unshipped, but Flutterwave refund returned: ${escapeHtmlSafe(flwRefundData?.message || "Gateway error")}`
        ).catch(() => {
        });
        continue;
      }
      const txCommitted = await withTransaction(async (client) => {
        const oRes = await client.query("SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE", [candidate.id]);
        if (oRes.rows.length === 0) return false;
        const ord = oRes.rows[0];
        if (!["paid", "packed"].includes(ord.status) || ord.admin_hold) return false;
        const dispCheck = await client.query(
          `SELECT id FROM shopit_disputes WHERE order_id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
          [ord.id]
        );
        if (dispCheck.rows.length > 0) return false;
        await restoreOrderStockInTx(client, ord);
        const items = Array.isArray(ord.items) ? ord.items : [];
        const sellerTotalsKobo = {};
        for (const item of items) {
          if (item.sellerId) {
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const kobo = (Number(item.sellerPriceKobo) || Math.round(Number(item.sellerPrice || 0) * 100)) * qty;
            sellerTotalsKobo[item.sellerId] = (sellerTotalsKobo[item.sellerId] || 0) + kobo;
          }
        }
        for (const [sId, sellerEarningsKobo] of Object.entries(sellerTotalsKobo)) {
          const wRes = await client.query(
            "SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
            [sId]
          );
          if (wRes.rows.length > 0) {
            const curPending = parseInt(String(wRes.rows[0].pending_balance_kobo || "0"), 10);
            const newPending = Math.max(0, curPending - sellerEarningsKobo);
            const idempKey = `unshipped_refund:${ord.id}:${sId}`;
            const ins = await client.query(
              `INSERT INTO shopit_ledger_entries (
                id, wallet_id, order_id, type, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES ($1, $2, $3, 'refund', 'pending', 'completed', $4, 0, $5, $6, $7, $8, NOW())
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `LEDGER-UNSHP-${ord.id}-${sId.slice(-6)}`,
                sId,
                ord.id,
                sellerEarningsKobo,
                newPending,
                `Auto-refund for never-shipped Order #${ord.id} (Day 5)`,
                ord.payment_reference || ord.id,
                idempKey
              ]
            );
            if (ins.rows.length > 0) {
              await client.query(
                `UPDATE shopit_wallets
                 SET pending_balance_kobo = $1, updated_at = NOW()
                 WHERE seller_id = $2`,
                [newPending, sId]
              );
            }
          }
        }
        await client.query(
          `UPDATE shopit_orders
           SET status = 'refunded',
               auto_release_at = NULL,
               notes = COALESCE(notes || ' | ', '') || 'Auto-cancelled & refunded after 5 days unshipped',
               updated_at = NOW()
           WHERE id = $1`,
          [ord.id]
        );
        if (ord.payment_reference) {
          await client.query(
            `UPDATE shopit_payments
             SET status = 'refunded',
                 data = $1,
                 updated_at = NOW()
             WHERE reference = $2`,
            [JSON.stringify({ ...payData, refundId: flwRefundData?.data?.id, flwTransactionId: flwTxId }), ord.payment_reference]
          );
        }
        await client.query(
          `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
           VALUES ($1, $2, $3, 'refunded', 'unshipped_auto_refund_cron', 'Order auto-cancelled and full buyer refund issued after 5 days without dispatch.', NOW())`,
          [`osh_unshp_${Date.now()}_${crypto4.randomBytes(3).toString("hex")}`, ord.id, ord.status]
        );
        return true;
      });
      if (txCommitted) {
        refundedOrderIds.push(candidate.id);
        if (candidate.buyer_email) {
          await sendBrevoDirect(
            candidate.buyer_email,
            `Full Refund Issued for Unshipped Order #${candidate.id}`,
            `Hi ${candidate.buyer_name || "Customer"}, because the seller did not ship Order #${candidate.id} within 5 days, Shop It automatically cancelled the order and initiated a full refund of \u20A6${refundNaira.toLocaleString()} back to your original payment method.`,
            `<p>Hi <strong>${escapeHtmlSafe(candidate.buyer_name || "Customer")}</strong>,</p><p>Because the seller did not dispatch Order <strong>#${escapeHtmlSafe(candidate.id)}</strong> within 5 days, Shop It automatically cancelled the order and triggered a full refund of <strong>\u20A6${refundNaira.toLocaleString()}</strong> to your payment method.</p>`,
            candidate.buyer_name
          ).catch(() => {
          });
        }
      }
    }
  } catch (err) {
    console.warn("[processUnshippedOrders Error]:", err.message);
  }
  return {
    remindedCount: remindedOrderIds.length,
    remindedOrderIds,
    refundedCount: refundedOrderIds.length,
    refundedOrderIds
  };
}
__name(processUnshippedOrders, "processUnshippedOrders");
async function runDailyReconciliationCheck() {
  let discrepancyCount = 0;
  try {
    const negRes = await query(
      `SELECT seller_id
       FROM shopit_wallets
       WHERE pending_balance_kobo < 0 OR available_balance_kobo < 0
       LIMIT 50`
    );
    discrepancyCount += negRes.rows.length;
    const walletsRes = await query(
      `SELECT seller_id, pending_balance_kobo, available_balance_kobo
       FROM shopit_wallets
       LIMIT 500`
    );
    for (const w of walletsRes.rows) {
      const ledRes = await query(
        `SELECT type, balance_type, amount_kobo, fee_kobo
         FROM shopit_ledger_entries
         WHERE wallet_id = $1`,
        [w.seller_id]
      );
      let derivedPending = 0;
      let derivedAvailable = 0;
      for (const l of ledRes.rows) {
        const amt = Number(l.amount_kobo || 0);
        const fee = Number(l.fee_kobo || 0);
        if (l.type === "sale_pending") {
          derivedPending += amt;
        } else if (l.type === "escrow_release") {
          derivedPending -= amt;
          derivedAvailable += amt;
        } else if (l.type === "withdrawal") {
          derivedAvailable -= amt + fee;
        } else if (l.type === "refund" || l.type === "reversal") {
          if (l.balance_type === "pending") derivedPending -= amt;
          else derivedAvailable += amt;
        }
      }
      const wPending = Number(w.pending_balance_kobo || 0);
      const wAvail = Number(w.available_balance_kobo || 0);
      if (wPending !== derivedPending || wAvail !== derivedAvailable) {
        discrepancyCount++;
      }
    }
    if (discrepancyCount > 0) {
      const dayKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      await sendAdminAlert(
        `daily_reconcile_${dayKey}`,
        `Daily Ledger Reconciliation Discrepancy Detected (${discrepancyCount})`,
        `The automated daily reconciliation check detected <strong>${discrepancyCount}</strong> wallet/ledger discrepancy count(s). Run <code>npx tsx scripts/reconcile-ledger.ts</code> to inspect.`
      );
    }
  } catch (err) {
    console.warn("[Daily Reconciliation Warning]:", err.message);
  }
  return {
    ok: discrepancyCount === 0,
    discrepancyCount
  };
}
__name(runDailyReconciliationCheck, "runDailyReconciliationCheck");

// server/auth/sessionStore.ts
import crypto5 from "crypto";
function getKvUrl() {
  return (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
}
__name(getKvUrl, "getKvUrl");
function getKvToken() {
  return (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
}
__name(getKvToken, "getKvToken");
async function runKvCommand(command, ...args) {
  const kvUrl = getKvUrl();
  const kvToken = getKvToken();
  if (!kvUrl || !kvToken) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const commandPayload = [
      command.toUpperCase(),
      ...args.map((a) => typeof a === "object" ? JSON.stringify(a) : String(a))
    ];
    const url = kvUrl.replace(/\/$/, "");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commandPayload),
      signal: controller.signal
    });
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    return json.result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
__name(runKvCommand, "runKvCommand");
function parseJsonArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
__name(parseJsonArray, "parseJsonArray");
var SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
var SESSION_COOKIE_NAME = "shopit_session";
async function createSession(data) {
  const token = "shopit_s_" + crypto5.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1e3;
  let resolvedTokenVersion = Number(data.tokenVersion || 1);
  if (!data.tokenVersion) {
    try {
      const uRes = await query("SELECT token_version FROM shopit_users WHERE id = $1", [data.userId]);
      if (uRes.rows[0]?.token_version) {
        resolvedTokenVersion = Number(uRes.rows[0].token_version);
      }
    } catch {
    }
  }
  const session = {
    sessionId: token,
    userId: data.userId,
    email: data.email.trim().toLowerCase(),
    name: data.name,
    role: data.role,
    subRole: data.role === "admin" && data.subRole ? data.subRole : void 0,
    sellerId: data.sellerId,
    isVerifiedSeller: data.isVerifiedSeller ?? false,
    mustChangePassword: Boolean(data.mustChangePassword),
    tokenVersion: resolvedTokenVersion,
    createdAt: now,
    expiresAt
  };
  await query(
    `INSERT INTO shopit_sessions (token, user_id, data, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE SET data = $3, expires_at = $4`,
    [token, data.userId, JSON.stringify(session), expiresAt]
  );
  if (getKvUrl() && getKvToken()) {
    await runKvCommand("setex", `session:${token}`, SESSION_TTL_SECONDS, JSON.stringify(session));
  }
  return { session, token };
}
__name(createSession, "createSession");
async function getSession(token) {
  if (!token || typeof token !== "string") return null;
  const cleanToken = token.trim();
  if (!cleanToken.startsWith("shopit_s_")) {
    return null;
  }
  let session = null;
  if (getKvUrl() && getKvToken()) {
    try {
      const raw = await runKvCommand("get", `session:${cleanToken}`);
      if (raw) {
        session = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch {
    }
  }
  if (!session) {
    try {
      const pgRes = await query(
        "SELECT data, expires_at FROM shopit_sessions WHERE token = $1",
        [cleanToken]
      );
      if (pgRes.rows.length > 0) {
        const row = pgRes.rows[0];
        session = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      }
    } catch (err) {
      console.warn("[Session Store] PostgreSQL lookup error:", err.message);
      return null;
    }
  }
  if (!session) return null;
  if (Date.now() > Number(session.expiresAt)) {
    await destroySession(cleanToken);
    return null;
  }
  try {
    const userRes = await query(
      `SELECT u.id, u.email, u.name, u.role, u.sub_role, u.is_banned, u.token_version, u.must_change_password,
              s.id AS seller_id, s.is_verified_seller AS s_verified
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.id = $1`,
      [session.userId]
    );
    if (userRes.rows.length === 0) {
      await destroySession(cleanToken);
      return null;
    }
    const u = userRes.rows[0];
    if (Boolean(u.is_banned)) {
      await destroySession(cleanToken);
      return null;
    }
    const dbTokenVersion = Number(u.token_version || 1);
    const sessTokenVersion = Number(session.tokenVersion || 1);
    if (dbTokenVersion !== sessTokenVersion) {
      await destroySession(cleanToken);
      return null;
    }
    session.role = u.role;
    session.subRole = u.role === "admin" && u.sub_role ? u.sub_role : void 0;
    session.sellerId = u.seller_id || session.sellerId;
    session.isVerifiedSeller = Boolean(u.s_verified);
    session.mustChangePassword = Boolean(u.must_change_password);
    session.tokenVersion = dbTokenVersion;
  } catch (err) {
    console.warn("[Session Store] User state check error:", err.message);
    return null;
  }
  return session;
}
__name(getSession, "getSession");
async function destroySession(token) {
  if (!token) return;
  const cleanToken = token.trim();
  try {
    await query("DELETE FROM shopit_sessions WHERE token = $1", [cleanToken]);
  } catch {
  }
  if (getKvUrl() && getKvToken()) {
    await runKvCommand("del", `session:${cleanToken}`);
  }
}
__name(destroySession, "destroySession");
async function revokeUserSessions(userId) {
  if (!userId) return;
  try {
    await query(
      "UPDATE shopit_users SET token_version = COALESCE(token_version, 1) + 1, updated_at = NOW() WHERE id = $1",
      [userId]
    );
    const sessRows = await query("SELECT token FROM shopit_sessions WHERE user_id = $1", [userId]);
    await query("DELETE FROM shopit_sessions WHERE user_id = $1", [userId]);
    if (getKvUrl() && getKvToken() && sessRows.rows.length > 0) {
      for (const r of sessRows.rows) {
        await runKvCommand("del", `session:${r.token}`);
      }
    }
  } catch (err) {
    console.warn("[Session Revocation Warning]:", err.message);
  }
}
__name(revokeUserSessions, "revokeUserSessions");
var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_DURATION_MS = 15 * 60 * 1e3;
async function recordLoginFailure(email) {
  const normEmail = email.trim().toLowerCase();
  const rlKey = `auth_fails:${normEmail}`;
  const now = Date.now();
  let count = 1;
  if (getKvUrl() && getKvToken()) {
    const res = await runKvCommand("incr", rlKey);
    if (res !== null) {
      count = Number(res) || 1;
      if (count === 1) {
        await runKvCommand("expire", rlKey, 900);
      }
      if (count >= MAX_FAILED_ATTEMPTS) {
        await runKvCommand("setex", `auth_locked:${normEmail}`, 900, String(now + LOCKOUT_DURATION_MS));
      }
    }
  }
  try {
    const existing = await query("SELECT timestamps FROM shopit_rate_limits WHERE key = $1", [rlKey]);
    const recent = parseJsonArray(existing.rows[0]?.timestamps).filter(
      (t) => now - t < LOCKOUT_DURATION_MS
    );
    recent.push(now);
    await query(
      "INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2",
      [rlKey, JSON.stringify(recent)]
    );
    count = Math.max(count, recent.length);
    if (count >= MAX_FAILED_ATTEMPTS) {
      await query(
        `UPDATE shopit_users
         SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW()
         WHERE LOWER(email) = LOWER($3)`,
        [count, new Date(now + LOCKOUT_DURATION_MS).toISOString(), normEmail]
      );
    } else {
      await query(
        `UPDATE shopit_users
         SET failed_login_attempts = $1, updated_at = NOW()
         WHERE LOWER(email) = LOWER($2)`,
        [count, normEmail]
      );
    }
  } catch {
  }
  if (count >= MAX_FAILED_ATTEMPTS) {
    return {
      locked: true,
      remainingAttempts: 0,
      lockoutRemainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1e3)
    };
  }
  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - count)
  };
}
__name(recordLoginFailure, "recordLoginFailure");
async function isAccountLocked(email) {
  const normEmail = email.trim().toLowerCase();
  const rlKey = `auth_fails:${normEmail}`;
  const now = Date.now();
  if (getKvUrl() && getKvToken()) {
    const lockedUntilStr = await runKvCommand("get", `auth_locked:${normEmail}`);
    if (lockedUntilStr) {
      const lockedUntil = Number(lockedUntilStr);
      if (lockedUntil > now) {
        return { locked: true, remainingSeconds: Math.ceil((lockedUntil - now) / 1e3) };
      }
    }
  }
  try {
    const uRes = await query(
      "SELECT locked_until FROM shopit_users WHERE LOWER(email) = LOWER($1)",
      [normEmail]
    );
    const lockedUntilPg = uRes.rows[0]?.locked_until;
    if (lockedUntilPg) {
      const ms = new Date(lockedUntilPg).getTime();
      if (ms > now) {
        return { locked: true, remainingSeconds: Math.ceil((ms - now) / 1e3) };
      }
    }
    const rlRes = await query("SELECT timestamps FROM shopit_rate_limits WHERE key = $1", [rlKey]);
    const recent = parseJsonArray(rlRes.rows[0]?.timestamps).filter(
      (t) => now - t < LOCKOUT_DURATION_MS
    );
    if (recent.length >= MAX_FAILED_ATTEMPTS) {
      const oldest = recent[0];
      const rem = Math.ceil((oldest + LOCKOUT_DURATION_MS - now) / 1e3);
      if (rem > 0) return { locked: true, remainingSeconds: rem };
    }
  } catch {
  }
  return { locked: false, remainingSeconds: 0 };
}
__name(isAccountLocked, "isAccountLocked");
async function clearLoginFailures(email) {
  const normEmail = email.trim().toLowerCase();
  const rlKey = `auth_fails:${normEmail}`;
  try {
    await query("DELETE FROM shopit_rate_limits WHERE key = $1", [rlKey]);
    await query(
      "UPDATE shopit_users SET failed_login_attempts = 0, locked_until = NULL WHERE LOWER(email) = LOWER($1)",
      [normEmail]
    );
  } catch {
  }
  if (getKvUrl() && getKvToken()) {
    await runKvCommand("del", rlKey);
    await runKvCommand("del", `auth_locked:${normEmail}`);
  }
}
__name(clearLoginFailures, "clearLoginFailures");
async function logAuditEvent(params) {
  const auditId = "audit_" + Date.now() + "_" + crypto5.randomBytes(4).toString("hex");
  try {
    await query(
      `INSERT INTO shopit_audit_logs (
        id, action, actor_id, actor_email, actor_role, target_type, target_id, details, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        auditId,
        params.action,
        params.actor.id || null,
        params.actor.email || null,
        params.actor.role || null,
        params.target.type || null,
        params.target.id || null,
        JSON.stringify(params.details || {}),
        params.ip || null,
        params.userAgent || null
      ]
    );
    console.log(
      `[SECURITY AUDIT] ${params.action} | Actor: ${params.actor.email || "anon"} (${params.actor.role || "none"}) | Target: ${params.target.type}:${params.target.id}`
    );
  } catch (err) {
    console.warn("[Audit Log Warning] Failed to insert audit log row:", err.message);
  }
}
__name(logAuditEvent, "logAuditEvent");

// server/webhooks/flutterwave.ts
var KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
var KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
async function runKvCommand2(command, ...args) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3e3);
    const res = await fetch(KV_URL.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([command.toUpperCase(), ...args.map((a) => String(a))]),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    return json.result;
  } catch {
    return null;
  }
}
__name(runKvCommand2, "runKvCommand");
async function getRawBodyBuffer(req) {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (req.body && Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf-8");
  const chunks = [];
  try {
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) return Buffer.concat(chunks);
  } catch {
  }
  if (req.body && typeof req.body === "object") {
    return Buffer.from(JSON.stringify(req.body), "utf-8");
  }
  return Buffer.from("");
}
__name(getRawBodyBuffer, "getRawBodyBuffer");
function timingSafeCompareHash(provided, expected) {
  const a = crypto6.createHash("sha256").update(provided).digest();
  const b = crypto6.createHash("sha256").update(expected).digest();
  return crypto6.timingSafeEqual(a, b);
}
__name(timingSafeCompareHash, "timingSafeCompareHash");
function logWebhookLine(event, txRef, result) {
  const safeEvent = String(event || "unknown").replace(/[\r\n\s]+/g, "_").slice(0, 60);
  const safeRef = String(txRef || "none").replace(/[\r\n\s]+/g, "_").slice(0, 100);
  console.log(`[FLW Webhook] event=${safeEvent} tx_ref=${safeRef} result=${result}`);
}
__name(logWebhookLine, "logWebhookLine");
async function handler(req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: "ok",
        message: "POST only"
      })
    );
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, GET, HEAD");
    res.statusCode = 405;
    return res.end(JSON.stringify({ status: false, message: "Method Not Allowed" }));
  }
  let logEvent = "unknown";
  let logTxRef = "none";
  if (process.env.PAYMENTS_ENABLED !== "true") {
    logWebhookLine(logEvent, logTxRef, "payments-disabled");
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        status: false,
        error: "PAYMENTS_DISABLED",
        message: "Online payments are coming soon. Arrange directly with the seller"
      })
    );
  }
  const secretKey = (process.env.FLW_SECRET_KEY || "").trim().replace(/^["']|["']$/g, "");
  const webhookSecretHash = (process.env.FLW_WEBHOOK_SECRET_HASH || "").trim().replace(/^["']|["']$/g, "");
  if (!webhookSecretHash || !secretKey) {
    logWebhookLine(logEvent, logTxRef, "missing-config");
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        status: false,
        message: "Flutterwave webhook verification hash or secret key is not configured."
      })
    );
  }
  try {
    const providedHash = String(req.headers["verif-hash"] || "").trim();
    if (!providedHash) {
      logWebhookLine(logEvent, logTxRef, "rejected-signature");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 401;
      return res.end(JSON.stringify({ status: false, message: "Missing verif-hash webhook signature" }));
    }
    if (!timingSafeCompareHash(providedHash, webhookSecretHash)) {
      logWebhookLine(logEvent, logTxRef, "rejected-signature");
      await logAuditEvent({
        action: "WEBHOOK_SIGNATURE_REJECTED",
        actor: { id: "flutterwave_webhook", email: "webhook@flutterwave", role: "system" },
        target: { type: "webhook", id: "flutterwave" },
        details: { reason: "Invalid verif-hash signature" },
        ip: req.ip,
        userAgent: req.headers?.["user-agent"]
      });
      await sendAdminAlert(
        `forged_webhook_${Math.floor(Date.now() / 6e4)}`,
        "Forged Flutterwave Webhook Attempt Blocked",
        `A webhook request failed <code>verif-hash</code> validation and was rejected with HTTP 401.`
      ).catch(() => {
      });
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 401;
      return res.end(JSON.stringify({ status: false, message: "Invalid webhook verif-hash signature" }));
    }
    const rawBuffer = await getRawBodyBuffer(req);
    const payload = JSON.parse(rawBuffer.toString("utf-8") || "{}");
    const event = String(payload.event || "").trim();
    const data = payload.data || {};
    logEvent = event || "unknown";
    logTxRef = String(data.tx_ref || data.reference || "none").trim() || "none";
    if (event === "transfer.completed") {
      const flwTransferStatus = String(data.status || "").toUpperCase();
      const transferRef = String(data.reference || "").trim();
      const flwTransferId = data.id ? String(data.id) : "";
      logTxRef = transferRef || flwTransferId || "none";
      if (!transferRef && !flwTransferId) {
        logWebhookLine(logEvent, logTxRef, "ignored");
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        return res.end(JSON.stringify({ status: true, message: "Transfer webhook missing reference; acknowledged." }));
      }
      const transferOutcome = await withTransaction(async (client) => {
        const pRes = await client.query(
          `SELECT * FROM shopit_payouts
           WHERE reference = $1 OR flw_transfer_id = $2
           FOR UPDATE`,
          [transferRef, flwTransferId]
        );
        if (pRes.rows.length === 0) {
          return { found: false };
        }
        const payout = pRes.rows[0];
        if (flwTransferStatus === "SUCCESSFUL") {
          await client.query(
            `UPDATE shopit_payouts
             SET status = 'success',
                 provider_response = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(data), payout.id]
          );
          await client.query(
            `UPDATE shopit_ledger_entries
             SET status = 'completed'
             WHERE reference = $1 AND type = 'withdrawal'`,
            [payout.reference]
          );
          return { found: true, outcome: "success", reference: payout.reference };
        }
        if (flwTransferStatus === "FAILED") {
          if (payout.status === "failed") {
            return { found: true, outcome: "already_reversed", reference: payout.reference };
          }
          const amountKobo = Number(payout.amount_kobo || 0);
          const feeKobo = Number(payout.fee_kobo || 0);
          const totalRestoreKobo = Number(payout.total_deduction_kobo || amountKobo + feeKobo);
          const wRes = await client.query(
            "SELECT available_balance_kobo, total_withdrawn_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
            [payout.seller_id]
          );
          if (wRes.rows.length > 0) {
            const curAvail = parseInt(String(wRes.rows[0].available_balance_kobo || "0"), 10);
            const curWtd = parseInt(String(wRes.rows[0].total_withdrawn_kobo || "0"), 10);
            const restoredAvail = curAvail + totalRestoreKobo;
            const restoredWtd = Math.max(0, curWtd - amountKobo);
            const idempotencyKey = `transfer_failed:${payout.reference}`;
            const ledIns = await client.query(
              `INSERT INTO shopit_ledger_entries (
                id, wallet_id, type, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES ($1, $2, 'refund', 'available', 'completed', $3, 0, $4, $5, $6, $7, NOW())
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `LEDGER-WTD-REV-${Date.now()}-${crypto6.randomBytes(3).toString("hex")}`,
                payout.seller_id,
                totalRestoreKobo,
                restoredAvail,
                `Failed payout reversal \xB7 ${payout.reference}`,
                payout.reference,
                idempotencyKey
              ]
            );
            if (ledIns.rows.length > 0) {
              await client.query(
                `UPDATE shopit_wallets
                 SET available_balance_kobo = $1,
                     total_withdrawn_kobo = $2, updated_at = NOW()
                 WHERE seller_id = $3`,
                [restoredAvail, restoredWtd, payout.seller_id]
              );
            }
          }
          await client.query(
            `UPDATE shopit_payouts
             SET status = 'failed',
                 provider_response = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(data), payout.id]
          );
          return { found: true, outcome: "reversed", reference: payout.reference };
        }
        return { found: true, outcome: flwTransferStatus, reference: payout.reference };
      });
      const tResult = !transferOutcome.found ? "not-found" : transferOutcome.outcome === "already_reversed" ? "duplicate" : transferOutcome.outcome === "reversed" ? "payout-reversed" : transferOutcome.outcome === "success" ? "accepted" : String(transferOutcome.outcome || "ignored");
      logWebhookLine(logEvent, logTxRef, tResult);
      await logAuditEvent({
        action: "PAYOUT_WEBHOOK_PROCESSED",
        actor: { id: "flutterwave_webhook", email: "webhook@flutterwave", role: "system" },
        target: { type: "payout", id: transferRef || flwTransferId },
        details: { status: flwTransferStatus, outcome: transferOutcome.outcome },
        ip: req.ip,
        userAgent: req.headers?.["user-agent"]
      });
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      return res.end(JSON.stringify({ status: true, ...transferOutcome }));
    }
    const reference = String(data.tx_ref || "").trim();
    const flwTransactionId = data.id ? String(data.id).trim() : "";
    logTxRef = reference || flwTransactionId || "none";
    if (event !== "charge.completed" || !reference && !flwTransactionId) {
      logWebhookLine(logEvent, logTxRef, "ignored");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      return res.end(JSON.stringify({ status: true, message: "Event ignored or ping acknowledged." }));
    }
    if (data.status && String(data.status).toLowerCase() !== "successful") {
      if (reference) {
        await query(
          `UPDATE shopit_payments
           SET status = $1, webhook_received = true, data = $2, updated_at = NOW()
           WHERE reference = $3 AND status IN ('pending', 'pending_payment')`,
          [String(data.status).toLowerCase(), JSON.stringify({ flwTransactionId, rawStatus: data.status }), reference]
        ).catch(() => {
        });
      }
      logWebhookLine(logEvent, logTxRef, "non-successful");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          status: true,
          isPaid: false,
          message: `Non-successful charge status (${data.status}) recorded without settlement.`
        })
      );
    }
    const verifyUrl = flwTransactionId ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(flwTransactionId)}/verify` : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    let verifyRes;
    let verifyData;
    try {
      verifyRes = await fetch(verifyUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });
      verifyData = await verifyRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }
    if (verifyRes.status >= 500) {
      logWebhookLine(logEvent, logTxRef, "upstream-error");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 502;
      return res.end(JSON.stringify({ status: false, message: "Flutterwave verification upstream temporarily unavailable." }));
    }
    if (!verifyRes.ok || verifyData?.status !== "success" || verifyData?.data?.status !== "successful") {
      logWebhookLine(logEvent, logTxRef, "verify-failed");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          status: false,
          message: "Flutterwave verification failed or transaction status is not successful."
        })
      );
    }
    const verifiedRef = String(verifyData.data.tx_ref || reference).trim();
    logTxRef = verifiedRef || logTxRef;
    if (!verifiedRef || reference && verifiedRef !== reference) {
      logWebhookLine(logEvent, logTxRef, "tx-ref-mismatch");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 400;
      return res.end(JSON.stringify({ status: false, message: "Verified tx_ref mismatch." }));
    }
    const verifiedCurrency = String(verifyData.data.currency || "").toUpperCase();
    const verifiedAmountKobo = Math.round(Number(verifyData.data.amount || 0) * 100);
    const channel = String(verifyData.data.payment_type || data.payment_type || "card");
    const settlement = await commitPaidOrderTransaction({
      reference: verifiedRef,
      confirmedAmountKobo: verifiedAmountKobo,
      currency: verifiedCurrency,
      channel,
      webhookReceived: true,
      customerEmail: verifyData.data.customer?.email || data.customer?.email,
      gatewayData: {
        flwTransactionId: verifyData.data.id,
        flwRef: verifyData.data.flw_ref,
        processorResponse: verifyData.data.processor_response,
        paymentType: channel
      },
      source: "flutterwave_webhook"
    });
    if (!settlement.found) {
      logWebhookLine(logEvent, logTxRef, "not-found");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 404;
      return res.end(JSON.stringify({ status: false, message: "Order reference (tx_ref) not found." }));
    }
    if (settlement.currencyMismatch || settlement.amountMismatch) {
      logWebhookLine(logEvent, logTxRef, settlement.amountMismatch ? "amount-mismatch" : "currency-mismatch");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 400;
      return res.end(JSON.stringify({ status: false, message: "Currency or paid amount mismatch." }));
    }
    if (settlement.expired) {
      logWebhookLine(logEvent, logTxRef, "expired");
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 409;
      return res.end(
        JSON.stringify({
          status: false,
          expired: true,
          message: "Order had already expired/cancelled. Flagged for admin refund."
        })
      );
    }
    if (settlement.committed) {
      await runKvCommand2("SETEX", `pay_evt:${verifiedRef}`, String(7 * 24 * 60 * 60), "1");
      await logAuditEvent({
        action: "ORDER_PAID_WEBHOOK",
        actor: {
          id: settlement.order?.buyer_id || "buyer",
          email: verifyData.data.customer?.email || settlement.order?.buyer_email || "buyer@shopit.ng",
          role: "buyer"
        },
        target: { type: "order", id: settlement.order?.id || verifiedRef },
        details: {
          reference: verifiedRef,
          amountNaira: koboToNaira(verifiedAmountKobo),
          channel,
          flwTransactionId: verifyData.data.id
        },
        ip: req.ip,
        userAgent: req.headers?.["user-agent"]
      });
    }
    logWebhookLine(logEvent, verifiedRef, settlement.alreadyPaid ? "duplicate" : "accepted");
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: true,
        alreadyProcessed: settlement.alreadyPaid,
        duplicate: Boolean(settlement.alreadyPaid),
        reference: verifiedRef,
        flwTransactionId: verifyData.data.id,
        message: settlement.alreadyPaid ? "Payment already settled (idempotent)." : "Flutterwave payment verified and settled into escrow ledger."
      })
    );
  } catch (err) {
    logWebhookLine(logEvent, logTxRef, "error");
    console.error("[Flutterwave Webhook Error]:", err.message);
    await sendAdminAlert(
      `webhook_err_${Math.floor(Date.now() / 6e4)}`,
      "Flutterwave Webhook Processing Error",
      `An internal or upstream timeout occurred while processing a webhook event: <code>${String(err.message || "Unknown error").slice(0, 200)}</code>`
    ).catch(() => {
    });
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 500;
    return res.end(JSON.stringify({ status: false, message: "Internal error processing Flutterwave webhook" }));
  }
}
__name(handler, "handler");

// server/db/otpStore.ts
import crypto7 from "crypto";
function parseJsonArray2(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
__name(parseJsonArray2, "parseJsonArray");
var OTP_EXPIRY_MS = 10 * 60 * 1e3;
var RESEND_COOLDOWN_MS = 60 * 1e3;
var RATE_LIMIT_WINDOW_MS = 15 * 60 * 1e3;
var MAX_EMAIL_REQUESTS = 5;
var MAX_DEVICE_REQUESTS = 10;
var SIGNUP_PROOF_TTL_MS = 30 * 60 * 1e3;
function hashOtp(code) {
  const perRecordSalt = crypto7.randomBytes(16).toString("hex");
  const otpKey = deriveSubKey("otp-hash", 32);
  const digest = crypto7.createHmac("sha256", otpKey).update(`${perRecordSalt}:${code.trim()}`).digest("hex");
  return `${perRecordSalt}:${digest}`;
}
__name(hashOtp, "hashOtp");
function verifyOtpHash(enteredCode, storedHash) {
  try {
    if (!storedHash || typeof storedHash !== "string") return false;
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [perRecordSalt, storedDigest] = parts;
    if (!perRecordSalt || !storedDigest) return false;
    const otpKey = deriveSubKey("otp-hash", 32);
    const computedDigest = crypto7.createHmac("sha256", otpKey).update(`${perRecordSalt}:${enteredCode.trim()}`).digest("hex");
    const computedBuf = Buffer.from(computedDigest, "utf8");
    const storedBuf = Buffer.from(storedDigest, "utf8");
    if (computedBuf.length !== storedBuf.length) return false;
    return crypto7.timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}
__name(verifyOtpHash, "verifyOtpHash");
function getKvUrl2() {
  return (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
}
__name(getKvUrl2, "getKvUrl");
function getKvToken2() {
  return (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
}
__name(getKvToken2, "getKvToken");
async function runKvCommand3(command, ...args) {
  const kvUrl = getKvUrl2();
  const kvToken = getKvToken2();
  if (!kvUrl || !kvToken) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const commandPayload = [
      command.toUpperCase(),
      ...args.map((a) => typeof a === "object" ? JSON.stringify(a) : String(a))
    ];
    const url = kvUrl.replace(/\/$/, "");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commandPayload),
      signal: controller.signal
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
__name(runKvCommand3, "runKvCommand");
async function checkAndRecordRateLimit(bucketKey, maxRequests, windowMs) {
  const now = Date.now();
  const cleanKey = `rl:${bucketKey}`;
  if (getKvUrl2() && getKvToken2()) {
    try {
      const windowSec = Math.max(1, Math.ceil(windowMs / 1e3));
      const countRaw = await runKvCommand3("INCR", cleanKey);
      if (countRaw !== null && countRaw !== void 0) {
        const count = Number(countRaw);
        if (count === 1) {
          await runKvCommand3("EXPIRE", cleanKey, windowSec);
        }
        if (count > maxRequests) {
          return { allowed: false, retryAfterSeconds: windowSec };
        }
        return { allowed: true };
      }
    } catch {
    }
  }
  return withTransaction(async (client) => {
    const res = await client.query(
      "SELECT timestamps FROM shopit_rate_limits WHERE key = $1 FOR UPDATE",
      [cleanKey]
    );
    const recent = parseJsonArray2(res.rows[0]?.timestamps).filter(
      (t) => now - t < windowMs
    );
    if (recent.length >= maxRequests) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1e3));
      return { allowed: false, retryAfterSeconds };
    }
    recent.push(now);
    await client.query(
      "INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2",
      [cleanKey, JSON.stringify(recent)]
    );
    return { allowed: true };
  });
}
__name(checkAndRecordRateLimit, "checkAndRecordRateLimit");
async function checkRateLimit(email, deviceId) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanDevice = (deviceId || "dev_unknown").trim();
  const now = Date.now();
  const emailKey = `shopit_rl_email_${cleanEmail}`;
  const devKey = `shopit_rl_dev_${cleanDevice}`;
  if (getKvUrl2() && getKvToken2()) {
    try {
      const pingRes = await runKvCommand3("PING");
      if (pingRes !== null) {
        const emailRaw = await runKvCommand3("GET", emailKey);
        const emailTimes2 = (emailRaw ? JSON.parse(emailRaw) : []).filter(
          (t) => now - t < RATE_LIMIT_WINDOW_MS
        );
        if (emailTimes2.length >= MAX_EMAIL_REQUESTS) {
          return {
            allowed: false,
            reason: "Too many OTP requests for this email. Please wait before trying again."
          };
        }
        if (cleanDevice !== "dev_unknown") {
          const devRaw = await runKvCommand3("GET", devKey);
          const devTimes = (devRaw ? JSON.parse(devRaw) : []).filter(
            (t) => now - t < RATE_LIMIT_WINDOW_MS
          );
          if (devTimes.length >= MAX_DEVICE_REQUESTS) {
            return {
              allowed: false,
              reason: "Too many OTP requests from this device. Please wait before trying again."
            };
          }
        }
        return { allowed: true };
      }
    } catch {
    }
  }
  const res = await query("SELECT timestamps FROM shopit_rate_limits WHERE key = $1", [emailKey]);
  const emailTimes = parseJsonArray2(res.rows[0]?.timestamps).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (emailTimes.length >= MAX_EMAIL_REQUESTS) {
    return {
      allowed: false,
      reason: "Too many OTP requests for this email. Please wait before trying again."
    };
  }
  if (cleanDevice !== "dev_unknown") {
    const dRes = await query("SELECT timestamps FROM shopit_rate_limits WHERE key = $1", [devKey]);
    const devTimes = parseJsonArray2(dRes.rows[0]?.timestamps).filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS
    );
    if (devTimes.length >= MAX_DEVICE_REQUESTS) {
      return {
        allowed: false,
        reason: "Too many OTP requests from this device. Please wait before trying again."
      };
    }
  }
  return { allowed: true };
}
__name(checkRateLimit, "checkRateLimit");
async function recordRateLimit(email, deviceId) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanDevice = (deviceId || "dev_unknown").trim();
  const now = Date.now();
  const emailKey = `shopit_rl_email_${cleanEmail}`;
  const devKey = `shopit_rl_dev_${cleanDevice}`;
  if (getKvUrl2() && getKvToken2()) {
    try {
      const emailRaw = await runKvCommand3("GET", emailKey);
      const emailTimes = (emailRaw ? JSON.parse(emailRaw) : []).filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
      );
      emailTimes.push(now);
      const setOk = await runKvCommand3("SET", emailKey, JSON.stringify(emailTimes));
      if (cleanDevice !== "dev_unknown") {
        const devRaw = await runKvCommand3("GET", devKey);
        const devTimes = (devRaw ? JSON.parse(devRaw) : []).filter(
          (t) => now - t < RATE_LIMIT_WINDOW_MS
        );
        devTimes.push(now);
        await runKvCommand3("SET", devKey, JSON.stringify(devTimes));
      }
      if (setOk !== null) {
        return;
      }
    } catch {
    }
  }
  await withTransaction(async (client) => {
    const res = await client.query(
      "SELECT timestamps FROM shopit_rate_limits WHERE key = $1 FOR UPDATE",
      [emailKey]
    );
    const emailTimes = parseJsonArray2(res.rows[0]?.timestamps).filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS
    );
    emailTimes.push(now);
    await client.query(
      "INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2",
      [emailKey, JSON.stringify(emailTimes)]
    );
    if (cleanDevice !== "dev_unknown") {
      const dRes = await client.query(
        "SELECT timestamps FROM shopit_rate_limits WHERE key = $1 FOR UPDATE",
        [devKey]
      );
      const devTimes = parseJsonArray2(dRes.rows[0]?.timestamps).filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
      );
      devTimes.push(now);
      await client.query(
        "INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2",
        [devKey, JSON.stringify(devTimes)]
      );
    }
  });
}
__name(recordRateLimit, "recordRateLimit");
async function checkResendCooldown(email, purpose) {
  const record = await getOtpRecord(email, purpose);
  if (!record) return { allowed: true };
  const now = Date.now();
  if (now < record.resendAvailableAt) {
    const waitSeconds = Math.ceil((record.resendAvailableAt - now) / 1e3);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true };
}
__name(checkResendCooldown, "checkResendCooldown");
async function saveHashedOtp(email, purpose, codeHash, metadata) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const now = Date.now();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;
  const record = {
    email: cleanEmail,
    purpose: cleanPurpose,
    codeHash,
    createdAt: now,
    expiresAt: now + OTP_EXPIRY_MS,
    resendAvailableAt: now + RESEND_COOLDOWN_MS,
    attemptsRemaining: 3,
    metadata
  };
  await query(
    "INSERT INTO shopit_otps (key, data, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET data = $2, expires_at = $3",
    [key, JSON.stringify(record), record.expiresAt]
  );
  return record;
}
__name(saveHashedOtp, "saveHashedOtp");
async function getOtpRecord(email, purpose) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;
  const res = await query("SELECT data, expires_at FROM shopit_otps WHERE key = $1", [key]);
  if (res.rows[0]) {
    const data = res.rows[0].data;
    return typeof data === "string" ? JSON.parse(data) : data;
  }
  return null;
}
__name(getOtpRecord, "getOtpRecord");
async function deleteOtpRecord(email, purpose) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;
  await query("DELETE FROM shopit_otps WHERE key = $1", [key]);
}
__name(deleteOtpRecord, "deleteOtpRecord");
async function verifyAndConsumeOtp(email, purpose, enteredCode) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;
  if (!enteredCode || !/^\d{6}$/.test(enteredCode.trim())) {
    return { success: false, error: "Please enter the 6-digit verification code." };
  }
  return withTransaction(async (client) => {
    const res = await client.query(
      "SELECT data, expires_at FROM shopit_otps WHERE key = $1 FOR UPDATE",
      [key]
    );
    if (res.rows.length === 0) {
      return { success: false, error: "No active verification code found. Please request a new code." };
    }
    const record = typeof res.rows[0].data === "string" ? JSON.parse(res.rows[0].data) : res.rows[0].data;
    if (Date.now() > Number(record.expiresAt)) {
      await client.query("DELETE FROM shopit_otps WHERE key = $1", [key]);
      return { success: false, error: "Verification code has expired. Please request a new code." };
    }
    if (verifyOtpHash(enteredCode.trim(), record.codeHash)) {
      await client.query("DELETE FROM shopit_otps WHERE key = $1", [key]);
      return { success: true, record };
    }
    const nextAttempts = Math.max(0, Number(record.attemptsRemaining) - 1);
    if (nextAttempts <= 0) {
      await client.query("DELETE FROM shopit_otps WHERE key = $1", [key]);
      return {
        success: false,
        attemptsRemaining: 0,
        error: "Too many incorrect attempts. This verification code has been invalidated. Request a new code."
      };
    }
    record.attemptsRemaining = nextAttempts;
    await client.query(
      "UPDATE shopit_otps SET data = $1 WHERE key = $2",
      [JSON.stringify(record), key]
    );
    return {
      success: false,
      attemptsRemaining: nextAttempts,
      error: `Invalid verification code. ${nextAttempts} attempt(s) remaining.`
    };
  });
}
__name(verifyAndConsumeOtp, "verifyAndConsumeOtp");
async function issueSignupVerificationToken(email) {
  const cleanEmail = email.trim().toLowerCase();
  const rawToken = "sproof_" + crypto7.randomBytes(32).toString("hex");
  const signupKey = deriveSubKey("signup-proof", 32);
  const tokenHash = crypto7.createHmac("sha256", signupKey).update(`${cleanEmail}:${rawToken}`).digest("hex");
  const expiresAt = Date.now() + SIGNUP_PROOF_TTL_MS;
  await query(
    `INSERT INTO shopit_verified_signups (email, token_hash, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET token_hash = $2, expires_at = $3`,
    [cleanEmail, tokenHash, expiresAt]
  );
  return rawToken;
}
__name(issueSignupVerificationToken, "issueSignupVerificationToken");
async function consumeSignupVerificationTokenInTx(client, email, rawToken) {
  const cleanEmail = email.trim().toLowerCase();
  if (!rawToken || typeof rawToken !== "string") return false;
  const signupKey = deriveSubKey("signup-proof", 32);
  const expectedHash = crypto7.createHmac("sha256", signupKey).update(`${cleanEmail}:${rawToken.trim()}`).digest("hex");
  const res = await client.query(
    "SELECT token_hash, expires_at FROM shopit_verified_signups WHERE email = $1 FOR UPDATE",
    [cleanEmail]
  );
  if (res.rows.length === 0) return false;
  const row = res.rows[0];
  if (Date.now() > Number(row.expires_at)) {
    await client.query("DELETE FROM shopit_verified_signups WHERE email = $1", [cleanEmail]);
    return false;
  }
  const storedBuf = Buffer.from(String(row.token_hash));
  const expectedBuf = Buffer.from(expectedHash);
  if (storedBuf.length !== expectedBuf.length || !crypto7.timingSafeEqual(storedBuf, expectedBuf)) {
    return false;
  }
  await client.query("DELETE FROM shopit_verified_signups WHERE email = $1", [cleanEmail]);
  return true;
}
__name(consumeSignupVerificationTokenInTx, "consumeSignupVerificationTokenInTx");
async function saveReportRecord(report) {
  await query(
    `INSERT INTO shopit_reports (id, target_type, target_id, target_title, reporter_email, reason, details, status, action_logs, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (id) DO UPDATE SET status = $8, action_logs = $9`,
    [
      report.id,
      report.targetType,
      report.targetId,
      report.targetTitle,
      report.reporterEmail || null,
      report.reason,
      report.details,
      report.status,
      JSON.stringify(report.actionLogs || [])
    ]
  );
}
__name(saveReportRecord, "saveReportRecord");
async function getAllReportRecords() {
  const res = await query("SELECT * FROM shopit_reports ORDER BY created_at DESC LIMIT 200");
  return res.rows.map((row) => ({
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetTitle: row.target_title,
    reporterEmail: row.reporter_email,
    reason: row.reason,
    details: row.details,
    status: row.status,
    actionLogs: parseJsonArray2(row.action_logs),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
  }));
}
__name(getAllReportRecords, "getAllReportRecords");
async function updateReportStatus(reportId, status, actionNote) {
  const existing = await query("SELECT action_logs FROM shopit_reports WHERE id = $1", [reportId]);
  const logs = parseJsonArray2(existing.rows[0]?.action_logs);
  if (actionNote) {
    logs.push({ action: `Status changed to ${status}`, note: actionNote, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  }
  await query("UPDATE shopit_reports SET status = $1, action_logs = $2 WHERE id = $3", [
    status,
    JSON.stringify(logs),
    reportId
  ]);
}
__name(updateReportStatus, "updateReportStatus");

// server/auth/middleware.ts
function extractToken(req) {
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return String(req.cookies[SESSION_COOKIE_NAME]).trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers["x-session-token"];
  if (customHeader && typeof customHeader === "string") {
    return customHeader.trim();
  }
  return null;
}
__name(extractToken, "extractToken");
async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      status: false,
      error: "UNAUTHORIZED",
      message: "Authentication required. Please sign in to continue."
    });
  }
  try {
    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({
        status: false,
        error: "SESSION_EXPIRED",
        message: "Your session has expired or is invalid. Please sign in again."
      });
    }
    req.user = session;
    req.sessionToken = token;
    if (session.mustChangePassword && !req.path.includes("/auth/change-password") && !req.path.includes("/auth/logout") && !req.path.includes("/auth/me")) {
      return res.status(403).json({
        status: false,
        error: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your initial password before performing this action."
      });
    }
    return next();
  } catch (err) {
    console.error("[Auth Middleware Error]:", err.message);
    return res.status(500).json({
      status: false,
      error: "AUTH_ERROR",
      message: "An error occurred while verifying your session."
    });
  }
}
__name(requireAuth, "requireAuth");
async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const session = await getSession(token);
      if (session) {
        req.user = session;
        req.sessionToken = token;
      }
    } catch {
    }
  }
  return next();
}
__name(optionalAuth, "optionalAuth");
function requireRole(...allowedRoles) {
  const fn = /* @__PURE__ */ __name(async function requireRoleMiddleware(req, res, next) {
    if (!req.user) {
      const authResult = await new Promise((resolve) => {
        requireAuth(req, res, () => resolve(true));
      });
      if (!authResult || !req.user) return;
    }
    if (allowedRoles.includes(req.user.role) || req.user.role === "admin") {
      return next();
    }
    logAuditEvent({
      action: "ACCESS_DENIED_ROLE_MISMATCH",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "route", id: req.originalUrl || req.url },
      details: { requiredRoles: allowedRoles, actualRole: req.user.role },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(403).json({
      status: false,
      error: "FORBIDDEN",
      message: `Access denied. Requires one of [${allowedRoles.join(", ")}] role.`
    });
  }, "requireRoleMiddleware");
  Object.defineProperty(fn, "name", { value: `requireRole(${allowedRoles.join(",")})` });
  return fn;
}
__name(requireRole, "requireRole");
var requireAdmin = requireRole("admin");
async function requireModerator(req, res, next) {
  if (!req.user) {
    const authResult = await new Promise((resolve) => {
      requireAuth(req, res, () => resolve(true));
    });
    if (!authResult || !req.user) return;
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({
      status: false,
      error: "FORBIDDEN",
      message: "Access denied. Administrator privileges required."
    });
  }
  const sub = req.user.subRole;
  if (sub === "moderator" || sub === "superadmin") {
    return next();
  }
  return res.status(403).json({
    status: false,
    error: "FORBIDDEN",
    message: "Access denied. Moderator sub-role required."
  });
}
__name(requireModerator, "requireModerator");
async function requireFinance(req, res, next) {
  if (!req.user) {
    const authResult = await new Promise((resolve) => {
      requireAuth(req, res, () => resolve(true));
    });
    if (!authResult || !req.user) return;
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({
      status: false,
      error: "FORBIDDEN",
      message: "Access denied. Administrator privileges required."
    });
  }
  const sub = req.user.subRole;
  if (sub === "finance" || sub === "superadmin") {
    return next();
  }
  return res.status(403).json({
    status: false,
    error: "FORBIDDEN",
    message: "Access denied. Finance sub-role required."
  });
}
__name(requireFinance, "requireFinance");
var requireSeller = requireRole("seller", "admin");
function requireOwnershipOrAdmin(getTargetUserId) {
  return /* @__PURE__ */ __name(async function requireOwnershipOrAdmin2(req, res, next) {
    if (!req.user) {
      const authResult = await new Promise((resolve) => {
        requireAuth(req, res, () => resolve(true));
      });
      if (!authResult || !req.user) return;
    }
    const targetUserId = getTargetUserId(req);
    if (!targetUserId) {
      return res.status(400).json({ status: false, message: "Invalid target identifier" });
    }
    if (req.user.role === "admin" || req.user.userId === targetUserId) {
      return next();
    }
    logAuditEvent({
      action: "OWNERSHIP_VIOLATION_BLOCKED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "user_resource", id: targetUserId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(403).json({
      status: false,
      error: "FORBIDDEN",
      message: "Access denied. You may only view or modify your own records."
    });
  }, "requireOwnershipOrAdmin");
}
__name(requireOwnershipOrAdmin, "requireOwnershipOrAdmin");
function requirePaymentsEnabled(_req, res, next) {
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return res.status(503).json({
      status: false,
      error: "PAYMENTS_DISABLED",
      message: "Online payments are coming soon. Arrange directly with the seller"
    });
  }
  return next();
}
__name(requirePaymentsEnabled, "requirePaymentsEnabled");
function requirePayoutsEnabled(_req, res, next) {
  if (process.env.PAYOUTS_ENABLED !== "true") {
    return res.status(503).json({
      status: false,
      error: "PAYOUTS_DISABLED",
      message: "Seller withdrawals are currently paused by safety switch. No balance was debited."
    });
  }
  return next();
}
__name(requirePayoutsEnabled, "requirePayoutsEnabled");

// server/lib/kycProvider.ts
function compareNames(typedName, registryName) {
  const typedTokens = typedName.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const regTokens = registryName.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (typedTokens.length === 0 || regTokens.length === 0) return 0;
  const matches = typedTokens.filter((t) => regTokens.includes(t)).length;
  return Math.round(matches / Math.max(typedTokens.length, 2) * 100);
}
__name(compareNames, "compareNames");
var LocalManualKycProvider = class {
  constructor() {
    this.name = "local_manual";
  }
  static {
    __name(this, "LocalManualKycProvider");
  }
  async verifyNin(_request) {
    return {
      success: false,
      provider: "local_manual",
      status: "manual_review_required",
      notes: "Queued for Trust & Safety moderator verification."
    };
  }
};
var PremblyKycProvider = class {
  constructor() {
    this.name = "prembly";
  }
  static {
    __name(this, "PremblyKycProvider");
  }
  async verifyNin(request) {
    const apiKey = (process.env.PREMBLY_API_KEY || "").trim();
    if (!apiKey) {
      return {
        success: false,
        provider: "prembly",
        status: "manual_review_required",
        notes: "Prembly key not configured; routed to manual review."
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8e3);
    try {
      const response = await fetch("https://api.prembly.com/identity-pass/verification/nin", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "app-id": process.env.PREMBLY_APP_ID || "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ number: request.nin }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status && data.data) {
        const nimcName = `${data.data.firstname || ""} ${data.data.middlename || ""} ${data.data.surname || ""}`.trim();
        const nimcDob = data.data.birthdate || data.data.dob || "";
        const nameScore = compareNames(request.fullName, nimcName);
        const dobMatch = Boolean(
          request.dateOfBirth && nimcDob && request.dateOfBirth.replace(/-/g, "") === nimcDob.replace(/-/g, "")
        );
        return {
          success: true,
          provider: "prembly",
          status: nameScore >= 60 && dobMatch ? "match" : "manual_review_required",
          verifiedLegalName: nimcName || void 0
        };
      }
    } catch (err) {
      console.warn("[KYC:Prembly] Lookup error, routing to manual review:", err.message);
    } finally {
      clearTimeout(timeout);
    }
    return {
      success: false,
      provider: "prembly",
      status: "manual_review_required"
    };
  }
};
var DojahKycProvider = class {
  constructor() {
    this.name = "dojah";
  }
  static {
    __name(this, "DojahKycProvider");
  }
  async verifyNin(request) {
    const appId = (process.env.DOJAH_APP_ID || "").trim();
    const privateKey = (process.env.DOJAH_PRIVATE_KEY || "").trim();
    if (!appId || !privateKey) {
      return {
        success: false,
        provider: "dojah",
        status: "manual_review_required",
        notes: "Dojah credentials not configured; routed to manual review."
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8e3);
    try {
      const response = await fetch(
        `https://api.dojah.io/api/v1/kyc/nin?nin=${encodeURIComponent(request.nin)}`,
        {
          method: "GET",
          headers: {
            AppId: appId,
            Authorization: privateKey
          },
          signal: controller.signal
        }
      );
      const data = await response.json().catch(() => ({}));
      const entity = data?.entity;
      if (response.ok && entity) {
        const nimcName = `${entity.first_name || ""} ${entity.middle_name || ""} ${entity.last_name || ""}`.trim();
        const nimcDob = entity.date_of_birth || "";
        const nameScore = compareNames(request.fullName, nimcName);
        const dobMatch = Boolean(
          request.dateOfBirth && nimcDob && request.dateOfBirth.replace(/-/g, "") === nimcDob.replace(/-/g, "")
        );
        return {
          success: true,
          provider: "dojah",
          status: nameScore >= 60 && dobMatch ? "match" : "manual_review_required",
          verifiedLegalName: nimcName || void 0
        };
      }
    } catch (err) {
      console.warn("[KYC:Dojah] Lookup error, routing to manual review:", err.message);
    } finally {
      clearTimeout(timeout);
    }
    return {
      success: false,
      provider: "dojah",
      status: "manual_review_required"
    };
  }
};
function getKycProvider(override) {
  const mode = (override || process.env.KYC_PROVIDER || "local").trim().toLowerCase();
  if (mode === "prembly") return new PremblyKycProvider();
  if (mode === "dojah") return new DojahKycProvider();
  return new LocalManualKycProvider();
}
__name(getKycProvider, "getKycProvider");

// server/app.ts
init_validation();

// server/routes/marketplace.ts
import express from "express";
import crypto8 from "crypto";
init_validation();
init_minorSafety();
var router = express.Router();
function buildInClause(values, startIndex = 1) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return { placeholders: "$1", params: ["__none__"] };
  return {
    placeholders: unique.map((_, i) => `$${startIndex + i}`).join(", "),
    params: unique
  };
}
__name(buildInClause, "buildInClause");
async function batchLoadUserMeta(userIds) {
  const map = /* @__PURE__ */ new Map();
  const cleanIds = Array.from(new Set(userIds.filter(Boolean)));
  if (cleanIds.length === 0) return map;
  const { placeholders, params } = buildInClause(cleanIds);
  const res = await query(
    `SELECT u.id, u.name, u.display_name, u.avatar_url, u.profile_slug, u.deleted_at,
            s.id as seller_id, s.shop_name, s.logo_url
     FROM shopit_users u
     LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
     WHERE u.id IN (${placeholders}) OR s.id IN (${placeholders})`,
    params
  ).catch(() => ({ rows: [] }));
  for (const row of res.rows) {
    const isDeleted = Boolean(row.deleted_at);
    const meta = {
      id: row.id,
      displayName: isDeleted ? "Deleted User" : row.display_name || extractFirstName(row.name || "Member"),
      avatarUrl: isDeleted ? void 0 : row.avatar_url || row.logo_url || void 0,
      profileSlug: isDeleted ? void 0 : row.profile_slug || void 0,
      isDeleted
    };
    map.set(row.id, meta);
    if (row.seller_id) {
      map.set(row.seller_id, meta);
    }
  }
  return map;
}
__name(batchLoadUserMeta, "batchLoadUserMeta");
function mapReviewWithUsers(rev, userMap) {
  const info = rev?.reviewerId ? userMap.get(String(rev.reviewerId)) : void 0;
  return {
    id: rev.id,
    productId: rev.productId,
    reviewerId: rev.reviewerId || void 0,
    reviewerName: info?.displayName || rev.reviewerName || "Verified Shopper",
    reviewerAvatarUrl: info?.avatarUrl || rev.reviewerAvatarUrl || void 0,
    reviewerProfileSlug: info?.profileSlug || rev.reviewerProfileSlug || void 0,
    rating: Number(rev.rating || 5),
    comment: rev.comment || "",
    date: rev.date || "",
    verifiedPurchase: Boolean(rev.verifiedPurchase ?? true)
  };
}
__name(mapReviewWithUsers, "mapReviewWithUsers");
async function notifyFollowersOfNewProduct(params) {
  try {
    const cleanIds = Array.from(new Set(params.sellerIds.filter(Boolean)));
    if (cleanIds.length === 0) return;
    const { placeholders, params: sParams } = buildInClause(cleanIds);
    const [folRes, muteRes] = await Promise.all([
      query(
        `SELECT DISTINCT f.follower_id, u.email, u.display_name, u.name, u.notification_prefs
         FROM shopit_follows f
         JOIN shopit_users u ON u.id = f.follower_id
         WHERE f.following_id IN (${placeholders})
           AND f.status = 'accepted'
           AND u.deleted_at IS NULL
           AND u.is_banned IS NOT TRUE`,
        sParams
      ),
      query(
        `SELECT muter_id FROM shopit_mutes WHERE muted_id IN (${placeholders})`,
        sParams
      )
    ]);
    const mutedFollowerSet = new Set(muteRes.rows.map((m) => String(m.muter_id)));
    const sellerIdSet = new Set(cleanIds);
    for (const r of folRes.rows) {
      const followerId = String(r.follower_id);
      if (!followerId || sellerIdSet.has(followerId) || mutedFollowerSet.has(followerId)) continue;
      await query(
        `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
         VALUES ($1, $2, $3, $4, 'info', false, $5, NOW())`,
        [
          `notif_newprod_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`,
          followerId,
          `New craft from ${params.shopName}`,
          `"${params.productTitle}" was just listed by ${params.shopName}.`,
          `/?product=${encodeURIComponent(params.productId)}`
        ]
      );
      try {
        const rawPrefs = typeof r.notification_prefs === "string" ? JSON.parse(r.notification_prefs) : r.notification_prefs;
        const prefs = sanitizeNotificationPrefs(rawPrefs || DEFAULT_NOTIFICATION_PREFS);
        if (prefs.emailFollowers && r.email && !String(r.email).endsWith(".local")) {
          const fname = r.display_name || extractFirstName(r.name || "Friend");
          sendBrevoDirect(
            r.email,
            `New craft from ${params.shopName}`,
            `Hi ${fname},

"${params.productTitle}" was just listed by ${params.shopName} on Shop It.`,
            `<p>Hi ${fname},</p><p><strong>${params.shopName}</strong> just listed <strong>${params.productTitle}</strong> on Shop It.</p>`,
            fname
          ).catch(() => {
          });
        }
      } catch {
      }
    }
  } catch (err) {
    console.warn("[Follower New Product Notification Note]:", err?.message || err);
  }
}
__name(notifyFollowersOfNewProduct, "notifyFollowersOfNewProduct");
var requirePaymentsEnabled2 = /* @__PURE__ */ __name((_req, res, next) => {
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return res.status(503).json({
      status: false,
      error: "PAYMENTS_DISABLED",
      message: "Online payments are coming soon. Arrange directly with the seller"
    });
  }
  next();
}, "requirePaymentsEnabled");
function isUserSellerOwner(user, sellerId) {
  if (!sellerId) return false;
  return sellerId === user.userId || Boolean(user.sellerId) && sellerId === user.sellerId;
}
__name(isUserSellerOwner, "isUserSellerOwner");
function isValidImageSource(raw) {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 42e5) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("blob:") || lower.startsWith("data:text/") || lower.includes("image/svg+xml") || lower.includes("<script")) {
    return false;
  }
  if (trimmed.startsWith("/")) return true;
  if (lower.startsWith("https://")) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(trimmed)) return true;
  return false;
}
__name(isValidImageSource, "isValidImageSource");
function sanitizeImageUrls(input, allowFallback = false) {
  if (input === void 0 || input === null) {
    return allowFallback ? { valid: true, urls: ["/shopit-logo.png"] } : { valid: false, urls: [], error: "Product images are required." };
  }
  if (!Array.isArray(input)) {
    return { valid: false, urls: [], error: "Images must be provided as an array." };
  }
  const cleaned = input.map((v) => String(v || "").trim()).filter(Boolean).slice(0, 6);
  if (cleaned.length === 0) {
    return allowFallback ? { valid: true, urls: ["/shopit-logo.png"] } : { valid: false, urls: [], error: "At least one valid image is required." };
  }
  for (const url of cleaned) {
    if (!isValidImageSource(url)) {
      return {
        valid: false,
        urls: [],
        error: "Invalid or unsafe image URL. Use an uploaded photo (PNG/JPG/WEBP), https:// URL, or local asset path."
      };
    }
  }
  return { valid: true, urls: cleaned };
}
__name(sanitizeImageUrls, "sanitizeImageUrls");
router.get("/products", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * limit;
    const category = req.query.category ? String(req.query.category).trim() : "";
    const search = req.query.search ? String(req.query.search).trim().slice(0, 100) : "";
    const sellerId = req.query.sellerId ? String(req.query.sellerId).trim() : "";
    const campus = req.query.campus ? String(req.query.campus).trim() : "";
    const state = req.query.state ? String(req.query.state).trim() : "";
    const city = req.query.city ? String(req.query.city).trim() : "";
    const area = req.query.area ? String(req.query.area).trim() : "";
    const sortBy = String(req.query.sortBy || "newest");
    const conditions = [
      "(p.is_paused IS NOT TRUE)",
      "(p.is_draft IS NOT TRUE)",
      "(u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE))"
    ];
    const params = [];
    let pIdx = 1;
    if (category && category !== "all") {
      conditions.push(`p.category = $${pIdx++}`);
      params.push(category);
    }
    if (sellerId) {
      conditions.push(`p.seller_id = $${pIdx++}`);
      params.push(sellerId);
    }
    if (campus && campus !== "All Campuses") {
      conditions.push(`p.seller_campus = $${pIdx++}`);
      params.push(campus);
    }
    if (state && state !== "all") {
      conditions.push(`p.location_state = $${pIdx++}`);
      params.push(state);
    }
    if (city && city !== "all") {
      conditions.push(`p.location_city = $${pIdx++}`);
      params.push(city);
    }
    if (area && area !== "all") {
      conditions.push(`p.location_area = $${pIdx++}`);
      params.push(area);
    }
    if (search) {
      conditions.push(`(p.title ILIKE $${pIdx} OR p.description ILIKE $${pIdx} OR p.seller_shop_name ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    let orderClause = sellerId ? "ORDER BY p.is_pinned DESC, p.pinned_at DESC NULLS LAST, p.created_at DESC" : "ORDER BY p.created_at DESC";
    if (sortBy === "price_asc") orderClause = "ORDER BY p.display_price_kobo ASC";
    else if (sortBy === "price_desc") orderClause = "ORDER BY p.display_price_kobo DESC";
    else if (sortBy === "top_rated") orderClause = "ORDER BY p.rating DESC, p.review_count DESC";
    const fromJoin = `
      FROM shopit_products p
      LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
      LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
    `;
    const countRes = await query(`SELECT COUNT(*) as count ${fromJoin} ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count, 10);
    const rowsRes = await query(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       ${fromJoin} ${whereClause} ${orderClause} LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );
    const reviewerIds = [];
    for (const r of rowsRes.rows) {
      const revs = Array.isArray(r.reviews) ? r.reviews : [];
      for (const rv of revs) {
        if (rv?.reviewerId) reviewerIds.push(String(rv.reviewerId));
      }
    }
    const reviewerMap = await batchLoadUserMeta(reviewerIds);
    const products = rowsRes.rows.map((row) => ({
      id: row.id,
      sellerId: row.seller_id,
      sellerShopName: row.seller_shop_name || row.u_display_name || "Artisan Shop",
      sellerDisplayName: row.u_display_name || extractFirstName(row.u_name || row.seller_shop_name || "Artisan"),
      sellerAvatarUrl: row.s_logo_url || row.u_avatar_url || void 0,
      sellerProfileSlug: row.u_profile_slug || void 0,
      sellerCampus: row.seller_campus || "Lagos Mainland",
      location: {
        state: row.location_state || "Lagos",
        city: row.location_city || "Lagos Mainland",
        area: row.location_area || "Yaba"
      },
      locationArea: row.location_area || "Yaba",
      sellerBadges: row.seller_badges || [],
      title: row.title,
      description: row.description || "",
      category: row.category || "crafts",
      sellerPrice: koboToNaira(row.seller_price_kobo || 0),
      serviceFee: koboToNaira(row.service_fee_kobo || 0),
      displayPrice: koboToNaira(row.display_price_kobo || 0),
      images: Array.isArray(row.images) ? row.images : [],
      stock: parseInt(row.stock, 10) || 0,
      rating: parseFloat(row.rating || 5),
      reviewCount: parseInt(row.review_count, 10) || 0,
      reviews: (Array.isArray(row.reviews) ? row.reviews : []).map((rv) => mapReviewWithUsers(rv, reviewerMap)),
      delivery: {
        allowsPickup: true,
        pickupLocation: `${row.location_area || "Hub"} Campus Pickup Spot`,
        pickupFee: koboToNaira(row.delivery_pickup_fee_kobo || 0),
        allowsLocalDelivery: true,
        localDeliveryFee: row.delivery_local_fee_kobo !== void 0 && row.delivery_local_fee_kobo !== null ? koboToNaira(row.delivery_local_fee_kobo) : 500,
        minOrderForDelivery: 1e3
      },
      isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
      isNewArrival: Boolean(row.is_new_arrival),
      isPaused: Boolean(row.is_paused),
      isDraft: Boolean(row.is_draft),
      isPinned: Boolean(row.is_pinned),
      pinnedAt: row.pinned_at || void 0,
      createdAt: row.created_at
    }));
    return res.json({
      status: true,
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("[Products List Error]:", err.message);
    return res.status(500).json({ status: false, message: "Error retrieving products." });
  }
});
router.get("/products/mine", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const sellerIds = Array.from(/* @__PURE__ */ new Set([user.userId, user.sellerId || user.userId]));
    const { placeholders, params } = buildInClause(sellerIds);
    const rowsRes = await query(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.seller_id IN (${placeholders})
       ORDER BY p.is_pinned DESC, p.pinned_at DESC NULLS LAST, p.created_at DESC`,
      params
    );
    const products = rowsRes.rows.map((row) => ({
      id: row.id,
      sellerId: row.seller_id,
      sellerShopName: row.seller_shop_name || "Artisan Shop",
      sellerDisplayName: row.u_display_name || extractFirstName(row.u_name || "Artisan"),
      sellerAvatarUrl: row.s_logo_url || row.u_avatar_url || void 0,
      sellerProfileSlug: row.u_profile_slug || void 0,
      sellerCampus: row.seller_campus || "Lagos Mainland",
      location: {
        state: row.location_state || "Lagos",
        city: row.location_city || "Lagos Mainland",
        area: row.location_area || "Yaba"
      },
      locationArea: row.location_area || "Yaba",
      sellerBadges: row.seller_badges || [],
      title: row.title,
      description: row.description || "",
      category: row.category || "crafts",
      sellerPrice: koboToNaira(row.seller_price_kobo || 0),
      serviceFee: koboToNaira(row.service_fee_kobo || 0),
      displayPrice: koboToNaira(row.display_price_kobo || 0),
      images: Array.isArray(row.images) ? row.images : [],
      stock: parseInt(row.stock, 10) || 0,
      rating: parseFloat(row.rating || 5),
      reviewCount: parseInt(row.review_count, 10) || 0,
      reviews: Array.isArray(row.reviews) ? row.reviews : [],
      delivery: {
        allowsPickup: true,
        pickupLocation: `${row.location_area || "Hub"} Campus Pickup Spot`,
        pickupFee: koboToNaira(row.delivery_pickup_fee_kobo || 0),
        allowsLocalDelivery: true,
        localDeliveryFee: row.delivery_local_fee_kobo !== void 0 && row.delivery_local_fee_kobo !== null ? koboToNaira(row.delivery_local_fee_kobo) : 500,
        minOrderForDelivery: 1e3
      },
      isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
      isNewArrival: Boolean(row.is_new_arrival),
      isPaused: Boolean(row.is_paused),
      isDraft: Boolean(row.is_draft),
      isPinned: Boolean(row.is_pinned),
      pinnedAt: row.pinned_at || void 0,
      createdAt: row.created_at
    }));
    return res.json({ status: true, products });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to load your listings." });
  }
});
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Product not found." });
    }
    const row = result.rows[0];
    const rawReviews = Array.isArray(row.reviews) ? row.reviews : [];
    const reviewerMap = await batchLoadUserMeta(rawReviews.map((rv) => rv?.reviewerId).filter(Boolean));
    return res.json({
      status: true,
      product: {
        id: row.id,
        sellerId: row.seller_id,
        sellerShopName: row.seller_shop_name,
        sellerDisplayName: row.u_display_name || extractFirstName(row.u_name || row.seller_shop_name || "Artisan"),
        sellerAvatarUrl: row.s_logo_url || row.u_avatar_url || void 0,
        sellerProfileSlug: row.u_profile_slug || void 0,
        sellerCampus: row.seller_campus,
        location: {
          state: row.location_state,
          city: row.location_city,
          area: row.location_area
        },
        locationArea: row.location_area,
        sellerBadges: row.seller_badges || [],
        title: row.title,
        description: row.description,
        category: row.category,
        sellerPrice: koboToNaira(row.seller_price_kobo || 0),
        serviceFee: koboToNaira(row.service_fee_kobo || 0),
        displayPrice: koboToNaira(row.display_price_kobo || 0),
        images: Array.isArray(row.images) ? row.images : [],
        stock: parseInt(row.stock, 10),
        rating: parseFloat(row.rating || 5),
        reviewCount: parseInt(row.review_count, 10) || 0,
        reviews: rawReviews.map((rv) => mapReviewWithUsers(rv, reviewerMap)),
        delivery: {
          allowsPickup: true,
          pickupLocation: `${row.location_area || "Hub"} Campus Pickup Spot`,
          pickupFee: koboToNaira(row.delivery_pickup_fee_kobo || 0),
          allowsLocalDelivery: true,
          localDeliveryFee: row.delivery_local_fee_kobo !== void 0 && row.delivery_local_fee_kobo !== null ? koboToNaira(row.delivery_local_fee_kobo) : 500,
          minOrderForDelivery: 1e3
        },
        isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
        isNewArrival: Boolean(row.is_new_arrival),
        isPaused: Boolean(row.is_paused),
        isDraft: Boolean(row.is_draft),
        isPinned: Boolean(row.is_pinned),
        pinnedAt: row.pinned_at || void 0,
        createdAt: row.created_at
      }
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/products", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const {
      title,
      description,
      category,
      sellerPrice,
      images,
      stock = 1,
      location,
      delivery
    } = req.body;
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    if (!cleanTitle || sellerPrice === void 0 || sellerPrice === null) {
      return res.status(400).json({ status: false, message: "A non-empty product title and seller price are required." });
    }
    const titleContactCheck = containsForbiddenContactInfo(cleanTitle);
    if (titleContactCheck.blocked) {
      return res.status(400).json({ status: false, message: `Title: ${titleContactCheck.reason}` });
    }
    const cleanDescription = description ? String(description).trim().slice(0, 2e3) : `${cleanTitle} crafted with care.`;
    const descContactCheck = containsForbiddenContactInfo(cleanDescription);
    if (descContactCheck.blocked) {
      return res.status(400).json({ status: false, message: `Description: ${descContactCheck.reason}` });
    }
    const rawSellerPriceNaira = parseFloat(sellerPrice);
    if (isNaN(rawSellerPriceNaira) || rawSellerPriceNaira < 100 || rawSellerPriceNaira > 1e7) {
      return res.status(400).json({ status: false, message: "Seller price must be between \u20A6100 and \u20A610,000,000." });
    }
    const imgCheck = sanitizeImageUrls(images, true);
    if (!imgCheck.valid) {
      return res.status(400).json({ status: false, message: imgCheck.error });
    }
    const sellerPriceKobo = nairaToKobo(rawSellerPriceNaira);
    const feePolicy = await getPlatformSetting("fee_settings", DEFAULT_FEE_SETTINGS_DB);
    const serviceFeeKobo = calculateConfiguredServiceFeeKobo(sellerPriceKobo, feePolicy);
    const displayPriceKobo = sellerPriceKobo + serviceFeeKobo;
    const pricing = {
      sellerPriceKobo,
      serviceFeeKobo,
      displayPriceKobo,
      sellerPriceNaira: koboToNaira(sellerPriceKobo),
      serviceFeeNaira: koboToNaira(serviceFeeKobo),
      displayPriceNaira: koboToNaira(displayPriceKobo)
    };
    const sellerId = user.role === "admin" && req.body.sellerId ? String(req.body.sellerId).trim() : user.sellerId || user.userId;
    const sellerRes = await query("SELECT * FROM shopit_sellers WHERE id = $1 OR user_id = $1", [sellerId]);
    let seller = sellerRes.rows[0];
    if (!seller) {
      await query(
        `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status, campus)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          sellerId,
          user.userId,
          req.body.sellerShopName || `${user.name}'s Shop`,
          user.name,
          user.email,
          false,
          "not_started",
          req.body.sellerCampus || "Lagos Mainland"
        ]
      );
      seller = {
        id: sellerId,
        user_id: user.userId,
        shop_name: req.body.sellerShopName || `${user.name}'s Shop`,
        is_verified_seller: false
      };
    }
    if (user.role === "buyer") {
      await query("UPDATE shopit_users SET role = 'seller', updated_at = NOW() WHERE id = $1", [user.userId]).catch(() => {
      });
    }
    const shopName = seller?.shop_name || req.body.sellerShopName || `${user.name}'s Shop`;
    const campus = seller?.campus || req.body.sellerCampus || "Lagos Mainland";
    const isVerified = Boolean(seller?.is_verified_seller || seller?.verification_status === "verified");
    const badges = Array.isArray(req.body.sellerBadges) ? req.body.sellerBadges.filter((b) => b !== "verified") : [];
    if (isVerified) {
      badges.push("verified");
    }
    const productId = `prod_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`;
    const imagesArray = imgCheck.urls;
    const rawParsedStock = parseInt(String(stock), 10);
    const parsedStock = Math.max(0, Math.min(1e4, Number.isNaN(rawParsedStock) ? 1 : rawParsedStock));
    const pickupFeeKobo = nairaToKobo(Math.max(0, Math.min(1e6, parseFloat(delivery?.pickupFee ?? "0") || 0)));
    const localDeliveryFeeKobo = nairaToKobo(Math.max(0, Math.min(1e6, parseFloat(delivery?.localDeliveryFee ?? "500") || 500)));
    const isDraft = Boolean(req.body.isDraft);
    const isPaused = Boolean(req.body.isPaused);
    await query(
      `INSERT INTO shopit_products (
        id, seller_id, seller_shop_name, seller_campus, title, description, category,
        seller_price_kobo, service_fee_kobo, display_price_kobo, stock, images,
        delivery_pickup_fee_kobo, delivery_local_fee_kobo, delivery_buyer_arranges,
        location_state, location_city, location_area, seller_badges,
        rating, review_count, is_sold_out, is_new_arrival, is_paused, is_draft, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, false,
        $15, $16, $17, $18,
        5.0, 0, $19, true, $20, $21, NOW(), NOW()
      )`,
      [
        productId,
        sellerId,
        shopName,
        campus,
        cleanTitle.slice(0, 200),
        cleanDescription,
        category || "crafts",
        pricing.sellerPriceKobo,
        pricing.serviceFeeKobo,
        pricing.displayPriceKobo,
        parsedStock,
        JSON.stringify(imagesArray),
        pickupFeeKobo,
        localDeliveryFeeKobo,
        location?.state || "Lagos",
        location?.city || "Lagos Mainland",
        location?.area || "Yaba",
        JSON.stringify(badges),
        parsedStock <= 0,
        isPaused,
        isDraft
      ]
    );
    if (!isDraft && !isPaused) {
      await notifyFollowersOfNewProduct({
        sellerIds: [sellerId, seller?.user_id || user.userId],
        shopName,
        productId,
        productTitle: cleanTitle.slice(0, 120)
      });
    }
    await logAuditEvent({
      action: "PRODUCT_CREATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "product", id: productId },
      details: { title, sellerPriceNaira: pricing.sellerPriceNaira, displayPriceNaira: pricing.displayPriceNaira },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({
      status: true,
      productId,
      message: "Product listed successfully in PostgreSQL database."
    });
  } catch (err) {
    console.error("[Product Create Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error creating product." });
  }
});
router.put("/products/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const existing = await query("SELECT * FROM shopit_products WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Product not found." });
    }
    const row = existing.rows[0];
    if (!isUserSellerOwner(user, row.seller_id) && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "You do not have permission to modify this product." });
    }
    const updates = req.body;
    let sellerPriceKobo = Number(row.seller_price_kobo || 0);
    let serviceFeeKobo = Number(row.service_fee_kobo || 0);
    let displayPriceKobo = Number(row.display_price_kobo || 0);
    if (updates.sellerPrice !== void 0) {
      const parsedPrice = parseFloat(updates.sellerPrice);
      if (isNaN(parsedPrice) || parsedPrice < 100) {
        return res.status(400).json({ status: false, message: "Minimum seller price is \u20A6100." });
      }
      const feePolicy = await getPlatformSetting("fee_settings", DEFAULT_FEE_SETTINGS_DB);
      sellerPriceKobo = nairaToKobo(parsedPrice);
      serviceFeeKobo = calculateConfiguredServiceFeeKobo(sellerPriceKobo, feePolicy);
      displayPriceKobo = sellerPriceKobo + serviceFeeKobo;
    }
    let title = row.title;
    if (updates.title !== void 0) {
      const cleanUpdateTitle = String(updates.title).trim().slice(0, 200);
      if (!cleanUpdateTitle) {
        return res.status(400).json({ status: false, message: "Product title cannot be empty." });
      }
      const tc = containsForbiddenContactInfo(cleanUpdateTitle);
      if (tc.blocked) {
        return res.status(400).json({ status: false, message: `Title: ${tc.reason}` });
      }
      title = cleanUpdateTitle;
    }
    const description = updates.description !== void 0 ? String(updates.description).trim().slice(0, 2e3) : row.description;
    if (updates.description !== void 0) {
      const dc = containsForbiddenContactInfo(description);
      if (dc.blocked) {
        return res.status(400).json({ status: false, message: `Description: ${dc.reason}` });
      }
    }
    const category = updates.category !== void 0 ? updates.category : row.category;
    const rawUpdateStock = updates.stock !== void 0 ? parseInt(String(updates.stock), 10) : parseInt(String(row.stock ?? 0), 10);
    const stock = Math.max(0, Math.min(1e4, Number.isNaN(rawUpdateStock) ? 0 : rawUpdateStock));
    const isSoldOut = stock <= 0;
    const isPaused = updates.isPaused !== void 0 ? Boolean(updates.isPaused) : Boolean(row.is_paused);
    const isDraft = updates.isDraft !== void 0 ? Boolean(updates.isDraft) : Boolean(row.is_draft);
    const deliveryPickupFeeKobo = updates.delivery?.pickupFee !== void 0 ? nairaToKobo(Math.max(0, Math.min(1e6, parseFloat(String(updates.delivery.pickupFee)) || 0))) : Number(row.delivery_pickup_fee_kobo || 0);
    const deliveryLocalFeeKobo = updates.delivery?.localDeliveryFee !== void 0 ? nairaToKobo(Math.max(0, Math.min(1e6, parseFloat(String(updates.delivery.localDeliveryFee)) || 0))) : Number(row.delivery_local_fee_kobo || 0);
    let images = JSON.stringify(row.images);
    if (updates.images !== void 0) {
      const imgUpdate = sanitizeImageUrls(updates.images, false);
      if (!imgUpdate.valid) {
        return res.status(400).json({ status: false, message: imgUpdate.error });
      }
      images = JSON.stringify(imgUpdate.urls);
    }
    const wasOutOfStock = Boolean(row.is_sold_out) || parseInt(String(row.stock || "0"), 10) <= 0;
    await query(
      `UPDATE shopit_products
       SET title = $1, description = $2, category = $3, seller_price_kobo = $4, service_fee_kobo = $5, display_price_kobo = $6,
           stock = $7, is_sold_out = $8, images = $9, is_paused = $10, is_draft = $11,
           delivery_pickup_fee_kobo = $12, delivery_local_fee_kobo = $13, updated_at = NOW()
       WHERE id = $14`,
      [
        title,
        description,
        category,
        sellerPriceKobo,
        serviceFeeKobo,
        displayPriceKobo,
        stock,
        isSoldOut,
        images,
        isPaused,
        isDraft,
        deliveryPickupFeeKobo,
        deliveryLocalFeeKobo,
        id
      ]
    );
    if (wasOutOfStock && stock > 0) {
      try {
        const subs = await query(
          "SELECT id, user_id, email FROM shopit_restock_alerts WHERE product_id = $1 AND notified = false",
          [id]
        );
        for (const sub of subs.rows) {
          await query(
            `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
             VALUES ($1, $2, $3, $4, 'success', false, $5, NOW())`,
            [
              `notif_restock_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`,
              sub.user_id,
              "Item Back in Stock!",
              `"${title}" is now restocked (${stock} available) on Shop It.`,
              `/?product=${encodeURIComponent(id)}`
            ]
          );
          if (sub.email) {
            void sendBrevoDirect(
              sub.email,
              `Back in Stock: ${title} on Shop It`,
              `Good news! "${title}" is back in stock on Shop It (${stock} available). Visit https://shopitng.vercel.app/?product=${encodeURIComponent(id)}`,
              `<p>Good news!</p><p><strong>${title}</strong> is back in stock on Shop It (${stock} available).</p><p><a href="https://shopitng.vercel.app/?product=${encodeURIComponent(id)}">View Item on Shop It</a></p>`
            ).catch(() => {
            });
          }
        }
        if (subs.rows.length > 0) {
          await query(
            "UPDATE shopit_restock_alerts SET notified = true WHERE product_id = $1 AND notified = false",
            [id]
          );
        }
      } catch (notifErr) {
        console.warn("[Restock Notification Warning]:", notifErr?.message || notifErr);
      }
    }
    if ((Boolean(row.is_draft) || Boolean(row.is_paused)) && !isDraft && !isPaused) {
      const sOwnerRes = await query("SELECT user_id, shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1 LIMIT 1", [row.seller_id]).catch(() => ({ rows: [] }));
      const sOwnerRow = sOwnerRes.rows[0];
      await notifyFollowersOfNewProduct({
        sellerIds: [row.seller_id, sOwnerRow?.user_id].filter(Boolean),
        shopName: sOwnerRow?.shop_name || row.seller_shop_name || "Artisan Shop",
        productId: id,
        productTitle: title.slice(0, 120)
      });
    }
    await logAuditEvent({
      action: "PRODUCT_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "product", id },
      details: { title, displayPriceNaira: koboToNaira(displayPriceKobo), stock, isSoldOut },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Product updated successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.patch("/products/:id/pin", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const pinned = Boolean(req.body?.pinned);
    const txResult = await withTransaction(async (client) => {
      const existing = await client.query("SELECT * FROM shopit_products WHERE id = $1 FOR UPDATE", [id]);
      if (existing.rows.length === 0) {
        return { code: 404, body: { status: false, message: "Product not found." } };
      }
      const row = existing.rows[0];
      if (!isUserSellerOwner(user, row.seller_id) && user.role !== "admin") {
        return { code: 403, body: { status: false, message: "You do not have permission to pin this product." } };
      }
      if (pinned) {
        if (row.is_draft) {
          return { code: 400, body: { status: false, message: "Publish your draft before pinning it to your profile." } };
        }
        const pinnedCountRes = await client.query(
          `SELECT COUNT(*) as total FROM shopit_products
           WHERE seller_id = $1 AND is_pinned = true AND id != $2 AND is_draft IS NOT TRUE`,
          [row.seller_id, id]
        );
        const count = parseInt(String(pinnedCountRes.rows[0]?.total || "0"), 10);
        if (count >= 3) {
          return {
            code: 400,
            body: {
              status: false,
              message: "You can pin at most 3 featured items on your profile. Unpin another item first."
            }
          };
        }
      }
      await client.query(
        "UPDATE shopit_products SET is_pinned = $1, pinned_at = $2, updated_at = NOW() WHERE id = $3",
        [pinned, pinned ? (/* @__PURE__ */ new Date()).toISOString() : null, id]
      );
      return {
        code: 200,
        body: {
          status: true,
          isPinned: pinned,
          message: pinned ? "Product pinned to the top of your profile." : "Product unpinned."
        }
      };
    });
    return res.status(txResult.code).json(txResult.body);
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to update pinned product." });
  }
});
router.delete("/products/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const existing = await query("SELECT * FROM shopit_products WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Product not found." });
    }
    const row = existing.rows[0];
    if (!isUserSellerOwner(user, row.seller_id) && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "You do not have permission to delete this product." });
    }
    await query("DELETE FROM shopit_products WHERE id = $1", [id]);
    await logAuditEvent({
      action: "PRODUCT_DELETED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "product", id },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Product deleted successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/products/:id/restock-alert", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const resRow = await query(
      "SELECT notified FROM shopit_restock_alerts WHERE product_id = $1 AND user_id = $2",
      [id, user.userId]
    );
    const subscribed = resRow.rows.length > 0 && !resRow.rows[0].notified;
    return res.json({ status: true, subscribed });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/products/:id/restock-alert", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const prodRes = await query("SELECT id, title, stock, is_sold_out FROM shopit_products WHERE id = $1", [id]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Product not found." });
    }
    const prod = prodRes.rows[0];
    if (!prod.is_sold_out && parseInt(String(prod.stock || "0"), 10) > 0) {
      return res.json({ status: true, subscribed: false, inStock: true, message: "This item is currently in stock." });
    }
    const alertId = `rstk_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`;
    await query(
      `INSERT INTO shopit_restock_alerts (id, product_id, user_id, email, notified, created_at)
       VALUES ($1, $2, $3, $4, false, NOW())
       ON CONFLICT (product_id, user_id) DO UPDATE SET notified = false, email = $4, created_at = NOW()`,
      [alertId, id, user.userId, user.email || null]
    );
    await logAuditEvent({
      action: "RESTOCK_ALERT_SUBSCRIBED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "product", id },
      details: { title: prod.title },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({
      status: true,
      subscribed: true,
      message: "Restock alert saved. You will be notified when this item is restocked."
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/sellers", async (_req, res) => {
  try {
    const result = await query(`
      SELECT s.*, u.display_name as u_display_name, u.profile_slug as u_profile_slug,
             u.avatar_url as u_avatar_url, u.cover_url as u_cover_url, u.deleted_at as u_deleted_at, u.is_banned as u_is_banned
      FROM shopit_sellers s
      LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
      WHERE u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE)
      ORDER BY s.created_at DESC
    `);
    const sellers = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id || row.id,
      shopName: row.shop_name,
      ownerName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || "Seller"),
      displayName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || "Seller"),
      profileSlug: row.u_profile_slug || row.id,
      logoUrl: row.logo_url || row.u_avatar_url || void 0,
      bannerUrl: row.banner_url || row.u_cover_url || void 0,
      avatarUrl: row.logo_url || row.u_avatar_url || void 0,
      bio: row.bio || "",
      campus: row.campus || "Lagos Mainland",
      location: {
        state: row.location_state || "Lagos",
        city: row.location_city || "Lagos Mainland",
        area: row.location_area || "Yaba"
      },
      locationArea: row.location_area || "Yaba",
      isVerifiedSeller: Boolean(row.is_verified_seller),
      verificationStatus: row.verification_status || "not_started",
      verifiedAt: row.verified_at,
      under18: Boolean(row.under_18),
      badges: Array.isArray(row.badges) ? row.is_verified_seller && !row.badges.includes("verified") ? [...row.badges, "verified"] : row.badges : row.is_verified_seller ? ["verified"] : [],
      level: 1,
      rating: parseFloat(row.rating || 5),
      reviewCount: 0,
      salesCount: parseInt(row.sales_count, 10) || 0,
      viewsCount: parseInt(row.views_count, 10) || 0,
      vacationMode: Boolean(row.vacation_mode),
      joinedDate: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "2026-01-01"
    }));
    return res.json({ status: true, sellers });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/sellers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT s.*, u.display_name as u_display_name, u.profile_slug as u_profile_slug,
              u.avatar_url as u_avatar_url, u.cover_url as u_cover_url, u.deleted_at as u_deleted_at
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
       WHERE s.id = $1 OR s.user_id = $1 OR LOWER(u.profile_slug) = LOWER($1)`,
      [id]
    );
    if (result.rows.length === 0 || result.rows[0].u_deleted_at) {
      return res.status(404).json({ status: false, message: "Seller not found." });
    }
    const row = result.rows[0];
    return res.json({
      status: true,
      seller: {
        id: row.id,
        userId: row.user_id || row.id,
        shopName: row.shop_name,
        ownerName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || "Seller"),
        displayName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || "Seller"),
        profileSlug: row.u_profile_slug || row.id,
        logoUrl: row.logo_url || row.u_avatar_url || void 0,
        bannerUrl: row.banner_url || row.u_cover_url || void 0,
        bio: row.bio || "",
        campus: row.campus || "Lagos Mainland",
        location: {
          state: row.location_state || "Lagos",
          city: row.location_city || "Lagos Mainland",
          area: row.location_area || "Yaba"
        },
        locationArea: row.location_area || "Yaba",
        isVerifiedSeller: Boolean(row.is_verified_seller),
        verificationStatus: row.verification_status || "not_started",
        verifiedAt: row.verified_at,
        under18: Boolean(row.under_18),
        badges: Array.isArray(row.badges) ? row.is_verified_seller && !row.badges.includes("verified") ? [...row.badges, "verified"] : row.badges : row.is_verified_seller ? ["verified"] : [],
        rating: parseFloat(row.rating || 5),
        salesCount: parseInt(row.sales_count, 10) || 0,
        viewsCount: parseInt(row.views_count, 10) || 0,
        vacationMode: Boolean(row.vacation_mode),
        joinedDate: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "2026-01-01"
      }
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.put("/sellers/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    if (!isUserSellerOwner(user, id) && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "Forbidden." });
    }
    const { shopName, bio, campus, location, vacationMode } = req.body;
    if (shopName) {
      const sc = containsForbiddenContactInfo(String(shopName));
      if (sc.blocked) return res.status(400).json({ status: false, message: `Shop name: ${sc.reason}` });
    }
    if (bio) {
      const bc = containsForbiddenContactInfo(String(bio));
      if (bc.blocked) return res.status(400).json({ status: false, message: `Shop bio: ${bc.reason}` });
    }
    await query(
      `UPDATE shopit_sellers
       SET shop_name = COALESCE($1, shop_name),
           bio = COALESCE($2, bio),
           campus = COALESCE($3, campus),
           location_state = COALESCE($4, location_state),
           location_city = COALESCE($5, location_city),
           location_area = COALESCE($6, location_area),
           vacation_mode = COALESCE($7, vacation_mode),
           updated_at = NOW()
       WHERE id = $8 OR user_id = $8`,
      [shopName, bio, campus, location?.state, location?.city, location?.area, vacationMode, id]
    );
    await logAuditEvent({
      action: "SELLER_PROFILE_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "seller", id },
      details: { shopName, campus, vacationMode },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Seller profile updated." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/sellers/upgrade", requireAuth, async (req, res) => {
  try {
    const authUser = req.user;
    const { shopName, bio, campus, location, locationArea, under18, guardianName } = req.body || {};
    const cleanShopName = String(shopName || "").trim().slice(0, 120);
    if (!cleanShopName || cleanShopName.length < 2) {
      return res.status(400).json({ status: false, message: "Please provide a valid shop name (at least 2 characters)." });
    }
    const sc = containsForbiddenContactInfo(cleanShopName);
    if (sc.blocked) {
      return res.status(400).json({ status: false, message: `Shop name: ${sc.reason}` });
    }
    if (under18 && (!guardianName || !String(guardianName).trim())) {
      return res.status(400).json({ status: false, message: "Youth sellers under 18 require parent/guardian consent." });
    }
    const userRes = await query("SELECT * FROM shopit_users WHERE id = $1", [authUser.userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "User account not found." });
    }
    const uRow = userRes.rows[0];
    const resolvedArea = locationArea || location?.area || "Yaba";
    const resolvedCampus = campus || "UNILAG (Akoka)";
    const resolvedBio = String(bio || "").trim().slice(0, 1e3);
    const bc = containsForbiddenContactInfo(resolvedBio);
    if (bc.blocked) {
      return res.status(400).json({ status: false, message: `Shop bio: ${bc.reason}` });
    }
    const existingSeller = await query(
      "SELECT * FROM shopit_sellers WHERE id = $1 OR user_id = $1",
      [authUser.userId]
    );
    let sellerId = authUser.userId;
    let isVerifiedSeller = false;
    let verificationStatus = "not_started";
    if (existingSeller.rows.length > 0) {
      const sRow = existingSeller.rows[0];
      sellerId = sRow.id;
      isVerifiedSeller = Boolean(sRow.is_verified_seller);
      verificationStatus = sRow.verification_status || "not_started";
      await query(
        `UPDATE shopit_sellers
         SET shop_name = $1, bio = $2, campus = $3, location_state = $4, location_city = $5, location_area = $6,
             under_18 = $7, guardian_consent = $8, guardian_name = COALESCE($9, guardian_name),
             updated_at = NOW()
         WHERE id = $10`,
        [
          cleanShopName,
          resolvedBio,
          resolvedCampus,
          location?.state || sRow.location_state || "Lagos",
          location?.city || sRow.location_city || "Lagos Mainland",
          resolvedArea,
          Boolean(under18),
          Boolean(under18),
          guardianName ? String(guardianName).trim() : null,
          sellerId
        ]
      );
    } else {
      await query(
        `INSERT INTO shopit_sellers (
          id, user_id, shop_name, owner_name, email, bio, campus,
          location_state, location_city, location_area,
          under_18, guardian_consent, guardian_name,
          is_verified_seller, verification_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, 'not_started', NOW(), NOW())`,
        [
          sellerId,
          authUser.userId,
          cleanShopName,
          uRow.name,
          uRow.email,
          resolvedBio,
          resolvedCampus,
          location?.state || "Lagos",
          location?.city || "Lagos Mainland",
          resolvedArea,
          Boolean(under18),
          Boolean(under18),
          guardianName ? String(guardianName).trim() : null
        ]
      );
    }
    if (uRow.role === "buyer") {
      await query("UPDATE shopit_users SET role = $1, updated_at = NOW() WHERE id = $2", ["seller", authUser.userId]);
    }
    await query(
      `INSERT INTO shopit_wallets (seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, 0, 0, 0, NOW(), NOW()) ON CONFLICT (seller_id) DO NOTHING`,
      [sellerId]
    );
    await query(
      `INSERT INTO shopit_admin_alerts (
        alert_key, id, alert_type, user_id, user_email, user_name, user_role, title, message, is_read, metadata, created_at
      ) VALUES ($1, $2, 'new_user', $3, $4, $5, 'seller', $6, $7, false, $8, NOW())
      ON CONFLICT (alert_key) DO UPDATE SET
        user_role = 'seller',
        title = $6,
        message = $7,
        is_read = false,
        created_at = NOW()`,
      [
        `new_user_${uRow.id}`,
        `alert_u_${uRow.id}`,
        uRow.id,
        uRow.email,
        uRow.display_name || uRow.name || cleanShopName,
        "User upgraded to seller",
        `${uRow.name} (${uRow.email}) opened shop "${cleanShopName}"`,
        JSON.stringify({ sellerId, shopName: cleanShopName, upgrade: true })
      ]
    ).catch(() => {
    });
    await logAuditEvent({
      action: "BUYER_UPGRADED_TO_SELLER",
      actor: { id: authUser.userId, email: uRow.email, role: uRow.role === "buyer" ? "seller" : uRow.role },
      target: { type: "seller", id: sellerId },
      details: { shopName: cleanShopName, campus: resolvedCampus, area: resolvedArea },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    const displayName = uRow.display_name || extractFirstName(uRow.name || "Seller");
    return res.json({
      status: true,
      user: {
        id: uRow.id,
        email: uRow.email,
        name: uRow.name,
        displayName,
        profileSlug: uRow.profile_slug,
        avatarUrl: uRow.avatar_url || void 0,
        role: uRow.role === "admin" ? "admin" : "seller",
        isVerifiedEmail: Boolean(uRow.is_verified_email),
        sellerProfile: {
          id: sellerId,
          shopName: cleanShopName,
          ownerName: displayName,
          bio: resolvedBio,
          campus: resolvedCampus,
          location: location || { state: "Lagos", city: "Lagos Mainland", area: resolvedArea },
          locationArea: resolvedArea,
          isVerifiedSeller,
          verificationStatus,
          under18: Boolean(under18),
          guardianConsent: Boolean(under18),
          guardianName: guardianName || void 0,
          badges: isVerifiedSeller ? ["verified"] : [],
          level: 1,
          rating: 5,
          reviewCount: 0,
          salesCount: 0,
          viewsCount: 0,
          vacationMode: false,
          joinedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
        }
      },
      message: "Seller shop created and saved in database."
    });
  } catch (err) {
    console.error("[Seller Upgrade Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error creating seller profile." });
  }
});
router.get("/cart", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const result = await query("SELECT items FROM shopit_carts WHERE user_id = $1", [user.userId]);
    const items = result.rows.length > 0 && Array.isArray(result.rows[0].items) ? result.rows[0].items : [];
    return res.json({ status: true, items });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.put("/cart", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { items = [] } = req.body;
    const sanitizedItems = Array.isArray(items) ? items.slice(0, 50) : [];
    await query(
      `INSERT INTO shopit_carts (user_id, items, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET items = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(sanitizedItems)]
    );
    await logAuditEvent({
      action: "CART_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "cart", id: user.userId },
      details: {
        itemCount: sanitizedItems.length,
        productTitles: sanitizedItems.map((i) => i?.product?.title || i?.title || i?.productId).filter(Boolean).slice(0, 5)
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Cart saved to database." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/wishlist", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const result = await query("SELECT product_ids FROM shopit_wishlists WHERE user_id = $1", [user.userId]);
    const productIds = result.rows.length > 0 && Array.isArray(result.rows[0].product_ids) ? result.rows[0].product_ids : [];
    return res.json({ status: true, productIds });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.put("/wishlist", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { productIds = [] } = req.body;
    const sanitizedIds = Array.isArray(productIds) ? productIds.slice(0, 100) : [];
    await query(
      `INSERT INTO shopit_wishlists (user_id, product_ids, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET product_ids = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(sanitizedIds)]
    );
    await logAuditEvent({
      action: "WISHLIST_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "wishlist", id: user.userId },
      details: { count: sanitizedIds.length, productIds: sanitizedIds.slice(0, 10) },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Wishlist saved to database." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/orders", requireAuth, async (req, res) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * limit;
    let querySql = "";
    let countSql = "";
    let params = [];
    let countParams = [];
    if (user.role === "admin") {
      countSql = "SELECT COUNT(*) as count FROM shopit_orders";
      querySql = "SELECT * FROM shopit_orders ORDER BY created_at DESC LIMIT $1 OFFSET $2";
      params = [limit, offset];
      countParams = [];
    } else if (user.role === "seller") {
      const sellerLookupId = user.sellerId || user.userId;
      countSql = `SELECT COUNT(*) as count FROM shopit_orders WHERE buyer_id = $1 OR items::text LIKE $2 OR items::text LIKE $3`;
      querySql = `SELECT * FROM shopit_orders WHERE buyer_id = $1 OR items::text LIKE $2 OR items::text LIKE $3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`;
      countParams = [user.userId, `%"sellerId":"${user.userId}"%`, `%"sellerId":"${sellerLookupId}"%`];
      params = [...countParams, limit, offset];
    } else {
      countSql = "SELECT COUNT(*) as count FROM shopit_orders WHERE buyer_id = $1";
      querySql = "SELECT * FROM shopit_orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3";
      countParams = [user.userId];
      params = [user.userId, limit, offset];
    }
    const countRes = await query(countSql, countParams);
    const total = parseInt(countRes.rows[0].count, 10);
    const rowsRes = await query(querySql, params);
    const participantIds = [];
    for (const r of rowsRes.rows) {
      if (r.buyer_id) participantIds.push(r.buyer_id);
      if (Array.isArray(r.items)) {
        for (const it of r.items) {
          if (it?.sellerId) participantIds.push(it.sellerId);
        }
      }
    }
    const userMap = await batchLoadUserMeta(participantIds);
    const orders = rowsRes.rows.map((row) => {
      const isBuyerOrAdmin = row.buyer_id === user.userId || user.role === "admin";
      const buyerMeta = row.buyer_id ? userMap.get(row.buyer_id) : void 0;
      const itemsList = Array.isArray(row.items) ? row.items : [];
      const primarySellerId = itemsList[0]?.sellerId;
      const sellerMeta = primarySellerId ? userMap.get(primarySellerId) : void 0;
      const resolvedBuyerDisplay = buyerMeta?.displayName || extractFirstName(row.buyer_name || "Shopper");
      return {
        id: row.id,
        buyerId: row.buyer_id,
        buyerDisplayName: resolvedBuyerDisplay,
        buyerAvatarUrl: buyerMeta?.avatarUrl,
        buyerProfileSlug: buyerMeta?.profileSlug,
        buyerName: user.role === "admin" ? row.buyer_name : void 0,
        buyerEmail: user.role === "admin" ? row.buyer_email : void 0,
        sellerDisplayName: sellerMeta?.displayName || itemsList[0]?.sellerShopName || "Artisan",
        sellerAvatarUrl: sellerMeta?.avatarUrl,
        sellerProfileSlug: sellerMeta?.profileSlug,
        deliveryArea: row.delivery_area || "Yaba",
        pickupPoint: row.pickup_point,
        items: itemsList,
        itemsSubtotal: koboToNaira(row.subtotal_kobo || 0),
        serviceFeeTotal: koboToNaira(row.service_fee_kobo || 0),
        deliveryTotal: koboToNaira(row.delivery_fee_kobo || 0),
        discountTotal: koboToNaira(row.discount_total_kobo || 0),
        grandTotal: koboToNaira(row.grand_total_kobo || 0),
        status: row.status,
        paymentMethod: row.payment_method || "online",
        paymentReference: row.payment_reference,
        // C8 Security: Never expose handshakeOtp to seller
        handshakeOtp: isBuyerOrAdmin ? row.handshake_otp : void 0,
        handshakeVerified: Boolean(row.handshake_verified),
        packedPhotoUrl: row.packed_photo_url || void 0,
        adminHold: Boolean(row.admin_hold),
        autoReleaseAt: row.auto_release_at,
        createdAt: row.created_at,
        packedAt: row.packed_at,
        shippedAt: row.shipped_at,
        deliveredAt: row.delivered_at,
        completedAt: row.completed_at,
        hasReview: Boolean(row.has_review)
      };
    });
    return res.json({
      status: true,
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/orders", requirePaymentsEnabled2, requireAuth, async (_req, res) => {
  const emergency = await getPlatformSetting("emergency_controls", DEFAULT_EMERGENCY_CONTROLS);
  if (emergency.pauseNewOrders || emergency.maintenanceMode) {
    return res.status(503).json({
      status: false,
      error: "ORDERS_PAUSED",
      message: "New orders are temporarily paused by platform moderation."
    });
  }
  return res.status(403).json({
    status: false,
    error: "DIRECT_ORDER_CREATION_DISABLED",
    message: "Orders cannot be created directly by the browser. Use payment checkout initialization instead."
  });
});
router.patch("/orders/:id/status", requireAuth, async (req, res) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user;
    const { id } = req.params;
    const { status: newStatus, notes, handshakeOtp, packedPhotoUrl } = req.body;
    const validTargets = ["packed", "shipped", "delivered", "completed", "disputed", "cancelled"];
    if (!newStatus || !validTargets.includes(newStatus)) {
      return res.status(400).json({ status: false, message: "Invalid order target status." });
    }
    if (packedPhotoUrl !== void 0 && packedPhotoUrl !== null && String(packedPhotoUrl).trim() !== "" && !isValidImageSource(packedPhotoUrl)) {
      return res.status(400).json({ status: false, message: "Invalid packing verification image format." });
    }
    const result = await withTransaction(async (client) => {
      const existing = await client.query("SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE", [id]);
      if (existing.rows.length === 0) {
        return { code: 404, body: { status: false, message: "Order not found." } };
      }
      const order = existing.rows[0];
      const prevStatus = order.status;
      const items = Array.isArray(order.items) ? order.items : [];
      const isAdmin = user.role === "admin";
      const isBuyer = order.buyer_id === user.userId;
      const isOrderSeller = items.some((item) => isUserSellerOwner(user, item.sellerId));
      if (!isAdmin && !isBuyer && !isOrderSeller) {
        await logAuditEvent({
          action: "ORDER_STATUS_IDOR_BLOCKED",
          actor: { id: user.userId, email: user.email, role: user.role },
          target: { type: "order", id },
          details: { attemptedStatus: newStatus },
          ip: req.ip,
          userAgent: req.get("user-agent")
        });
        return { code: 403, body: { status: false, message: "You are not authorized to modify this order." } };
      }
      if (newStatus === "packed") {
        if (!isOrderSeller && !isAdmin) {
          return { code: 403, body: { status: false, message: "Only the seller can mark an order as packed." } };
        }
        if (prevStatus !== "paid") {
          return { code: 400, body: { status: false, message: `Cannot mark as packed from status '${prevStatus}'.` } };
        }
      } else if (newStatus === "shipped") {
        if (!isOrderSeller && !isAdmin) {
          return { code: 403, body: { status: false, message: "Only the seller can mark an order as shipped." } };
        }
        if (prevStatus !== "paid" && prevStatus !== "packed") {
          return { code: 400, body: { status: false, message: `Cannot mark as shipped from status '${prevStatus}'.` } };
        }
      } else if (newStatus === "delivered" || newStatus === "completed") {
        const allowedFrom = newStatus === "delivered" ? ["shipped", ...isAdmin ? ["packed"] : []] : ["shipped", "delivered"];
        if (!allowedFrom.includes(prevStatus)) {
          return { code: 400, body: { status: false, message: `Cannot transition order from '${prevStatus}' to '${newStatus}'.` } };
        }
        let otpMatched = false;
        if (handshakeOtp && order.handshake_otp) {
          const suppliedBuf = Buffer.from(String(handshakeOtp).trim());
          const expectedBuf = Buffer.from(String(order.handshake_otp).trim());
          otpMatched = suppliedBuf.length === expectedBuf.length && crypto8.timingSafeEqual(suppliedBuf, expectedBuf);
        }
        if (!isBuyer && !isAdmin && !(isOrderSeller && otpMatched)) {
          return {
            code: 403,
            body: {
              status: false,
              message: "Only the buyer or a seller presenting the buyer\u2019s valid 4-digit Handshake OTP may confirm delivery."
            }
          };
        }
      } else if (newStatus === "disputed") {
        if (!["paid", "packed", "shipped", "delivered"].includes(prevStatus)) {
          return { code: 400, body: { status: false, message: `Cannot dispute an order in '${prevStatus}' status.` } };
        }
      } else if (newStatus === "cancelled") {
        if (!isAdmin && !isBuyer) {
          return { code: 403, body: { status: false, message: "Only the buyer (before packing) or an administrator can cancel an order." } };
        }
        if (!isAdmin && prevStatus !== "paid") {
          return { code: 403, body: { status: false, message: `Orders cannot be cancelled by the buyer once status is '${prevStatus}'. Please open a dispute if you have an issue.` } };
        }
        if (!["pending_payment", "paid"].includes(prevStatus)) {
          return { code: 400, body: { status: false, message: `Cannot cancel order from status '${prevStatus}'.` } };
        }
      }
      const isReleasingEscrow = (newStatus === "delivered" || newStatus === "completed") && prevStatus !== "delivered" && prevStatus !== "completed";
      if ((isReleasingEscrow || newStatus === "cancelled") && !isAdmin) {
        const disputeCheck = await client.query(
          `SELECT id FROM shopit_disputes WHERE order_id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
          [id]
        );
        if (disputeCheck.rows.length > 0) {
          return {
            code: 409,
            body: { status: false, message: "Cannot modify order status while an active dispute exists on this order." }
          };
        }
      }
      let handshakeVerified = Boolean(order.handshake_verified);
      if ((newStatus === "delivered" || newStatus === "completed") && (isBuyer || handshakeOtp)) {
        handshakeVerified = true;
      }
      const cleanPackedPhoto = newStatus === "packed" && packedPhotoUrl && String(packedPhotoUrl).trim() ? String(packedPhotoUrl).trim() : null;
      await client.query(
        `UPDATE shopit_orders
         SET status = $1,
             handshake_verified = $2,
             packed_photo_url = COALESCE($3, packed_photo_url),
             packed_at = CASE WHEN $1 = 'packed' THEN NOW() ELSE packed_at END,
             shipped_at = CASE WHEN $1 = 'shipped' THEN NOW() ELSE shipped_at END,
             delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END,
             completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $4`,
        [newStatus, handshakeVerified, cleanPackedPhoto, id]
      );
      await client.query(
        `INSERT INTO shopit_order_status_history (
          id, order_id, previous_status, new_status, changed_by, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          `osh_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`,
          id,
          prevStatus,
          newStatus,
          user.userId,
          notes || `Status updated from ${prevStatus} to ${newStatus}`
        ]
      );
      if (isReleasingEscrow) {
        const sellerTotals = {};
        for (const item of items) {
          if (item.sellerId) {
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const itemKobo = Math.round(Number(item.sellerPrice || 0) * 100) * qty;
            sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemKobo;
          }
        }
        for (const [sId, amountKobo] of Object.entries(sellerTotals)) {
          const wRes = await client.query(
            "SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
            [sId]
          );
          if (wRes.rows.length > 0) {
            const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || "0", 10);
            const currentAvailable = parseInt(wRes.rows[0].available_balance_kobo || "0", 10);
            const newPending = Math.max(0, currentPending - amountKobo);
            const newAvailable = currentAvailable + amountKobo;
            const idempotencyKey = `escrow_release:${id}:${sId}`;
            const ledgerIns = await client.query(
              `INSERT INTO shopit_ledger_entries (
                id, wallet_id, order_id, type, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES (
                $1, $2, $3, 'escrow_release', 'available', 'completed',
                $4, 0, $5, $6, $7, $8, NOW()
              )
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `ESCROW-REL-${id}-${sId.slice(-6)}`,
                sId,
                id,
                amountKobo,
                newAvailable,
                `Escrow released for delivered Order #${id}`,
                order.payment_reference || id,
                idempotencyKey
              ]
            );
            if (ledgerIns.rows.length > 0) {
              await client.query(
                `UPDATE shopit_wallets
                 SET pending_balance_kobo = $1,
                     available_balance_kobo = $2,
                     updated_at = NOW()
                 WHERE seller_id = $3`,
                [newPending, newAvailable, sId]
              );
            }
          }
        }
      }
      if (newStatus === "cancelled") {
        await restoreOrderStockInTx(client, order);
        await client.query(
          "UPDATE shopit_orders SET auto_release_at = NULL, updated_at = NOW() WHERE id = $1",
          [id]
        );
        if (prevStatus === "paid") {
          const sellerTotalsKobo = {};
          for (const item of items) {
            if (item.sellerId) {
              const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
              const kobo = (Number(item.sellerPriceKobo) || Math.round(Number(item.sellerPrice || 0) * 100)) * qty;
              sellerTotalsKobo[item.sellerId] = (sellerTotalsKobo[item.sellerId] || 0) + kobo;
            }
          }
          for (const [sId, amountKobo] of Object.entries(sellerTotalsKobo)) {
            const wRes = await client.query(
              "SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
              [sId]
            );
            if (wRes.rows.length > 0) {
              const currentPending = parseInt(String(wRes.rows[0].pending_balance_kobo || "0"), 10);
              const debitKobo = Math.min(currentPending, amountKobo);
              const nextPending = Math.max(0, currentPending - debitKobo);
              const idempotencyKey = `order_cancel_refund:${id}:${sId}`;
              const ledIns = await client.query(
                `INSERT INTO shopit_ledger_entries (
                  id, wallet_id, order_id, type, balance_type, status,
                  amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
                ) VALUES (
                  $1, $2, $3, 'refund', 'pending', 'completed',
                  $4, 0, $5, $6, $7, $8, NOW()
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id`,
                [
                  `CANCEL-REF-${id}-${sId.slice(-6)}`,
                  sId,
                  id,
                  debitKobo,
                  nextPending,
                  `Order #${id} cancelled before packing; escrow reversed for buyer refund`,
                  order.payment_reference || id,
                  idempotencyKey
                ]
              );
              if (ledIns.rows.length > 0) {
                await client.query(
                  `UPDATE shopit_wallets
                   SET pending_balance_kobo = $1, updated_at = NOW()
                   WHERE seller_id = $2`,
                  [nextPending, sId]
                );
              }
            }
          }
        }
      }
      return {
        code: 200,
        body: { status: true, message: `Order status updated to ${newStatus}.` },
        audit: { prevStatus, newStatus, isReleasingEscrow },
        cancelledPaidOrder: newStatus === "cancelled" && prevStatus === "paid" ? order : null
      };
    });
    if (result.code === 200 && result.cancelledPaidOrder) {
      const ord = result.cancelledPaidOrder;
      const items = Array.isArray(ord.items) ? ord.items : [];
      const flwSecret = (process.env.FLW_SECRET_KEY || "").trim().replace(/^["']|["']$/g, "");
      if (process.env.PAYMENTS_ENABLED === "true" && flwSecret && ord.payment_reference) {
        try {
          const payRes = await query("SELECT data FROM shopit_payments WHERE reference = $1 OR order_id = $2 LIMIT 1", [
            ord.payment_reference,
            id
          ]);
          const payData = payRes.rows[0]?.data || {};
          const flwTxId = payData?.flwTransactionId || payData?.id;
          const refundNaira = koboToNaira(ord.grand_total_kobo || 0);
          if (flwTxId && refundNaira > 0) {
            const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(flwTxId))}/refund`, {
              method: "POST",
              headers: { Authorization: `Bearer ${flwSecret}`, "Content-Type": "application/json" },
              body: JSON.stringify({ amount: refundNaira, comments: `Buyer cancelled unpacked Order #${id}` })
            });
            if (flwRes.ok) {
              await query("UPDATE shopit_payments SET status = $1, updated_at = NOW() WHERE reference = $2", [
                "refunded",
                ord.payment_reference
              ]);
            }
          }
        } catch (refundErr) {
          console.warn("[Order Cancel Gateway Refund Warning]:", refundErr?.message || refundErr);
        }
      }
      for (const sId of Array.from(new Set(items.map((i) => i.sellerId).filter(Boolean)))) {
        const sRow = await query("SELECT user_id FROM shopit_sellers WHERE id = $1 OR user_id = $1 LIMIT 1", [sId]).catch(() => ({ rows: [] }));
        const targetUid = sRow.rows[0]?.user_id || sId;
        await query(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, 'Order Cancelled', $3, 'info', false, '/dashboard', NOW())`,
          [
            `notif_cancel_${Date.now()}_${crypto8.randomBytes(2).toString("hex")}`,
            targetUid,
            `Order #${id} was cancelled by the buyer before packing. Item stock has been restored.`
          ]
        ).catch(() => {
        });
      }
    }
    if (result.code === 200 && result.audit) {
      await logAuditEvent({
        action: "ORDER_STATUS_CHANGED",
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: "order", id },
        details: result.audit,
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
    }
    return res.status(result.code).json(result.body);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/orders/:id/review", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { productId, rating, comment } = req.body || {};
    const numRating = Math.round(Number(rating));
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ status: false, message: "Rating must be between 1 and 5 stars." });
    }
    const cleanComment = String(comment || "").trim().slice(0, 600);
    if (cleanComment.length < 3) {
      return res.status(400).json({ status: false, message: "Please write at least a brief review comment." });
    }
    const txResult = await withTransaction(async (client) => {
      const ordRes = await client.query("SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE", [id]);
      if (ordRes.rows.length === 0) {
        return { code: 404, body: { status: false, message: "Order not found." } };
      }
      const order = ordRes.rows[0];
      if (order.buyer_id !== user.userId && user.role !== "admin") {
        return { code: 403, body: { status: false, message: "Only the buyer of this order can leave a review." } };
      }
      if (!["delivered", "completed"].includes(order.status)) {
        return { code: 400, body: { status: false, message: "You can review an order once it has been delivered or completed." } };
      }
      if (order.has_review) {
        return { code: 409, body: { status: false, message: "You have already reviewed this order." } };
      }
      const items = Array.isArray(order.items) ? order.items : [];
      const targetItem = productId ? items.find((i) => i.productId === productId) : items[0];
      const targetProductId = targetItem?.productId || items[0]?.productId;
      if (!targetProductId) {
        return { code: 400, body: { status: false, message: "No product associated with this order." } };
      }
      const prodRes = await client.query("SELECT id, seller_id, reviews FROM shopit_products WHERE id = $1 FOR UPDATE", [targetProductId]);
      if (prodRes.rows.length === 0) {
        return { code: 404, body: { status: false, message: "Product listing no longer exists." } };
      }
      const prod = prodRes.rows[0];
      const existingReviews = Array.isArray(prod.reviews) ? prod.reviews : [];
      const uRes = await client.query(
        "SELECT name, display_name, avatar_url, profile_slug FROM shopit_users WHERE id = $1 LIMIT 1",
        [user.userId]
      );
      const uRow = uRes.rows[0];
      const reviewerName = uRow?.display_name || extractFirstName(uRow?.name || user.name || "Member");
      const reviewEntry = {
        id: `rev_${Date.now()}_${crypto8.randomBytes(2).toString("hex")}`,
        productId: targetProductId,
        reviewerId: user.userId,
        reviewerName,
        reviewerAvatarUrl: uRow?.avatar_url || void 0,
        reviewerProfileSlug: uRow?.profile_slug || void 0,
        rating: numRating,
        comment: cleanComment,
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        verifiedPurchase: true
      };
      const updatedReviews = [reviewEntry, ...existingReviews];
      const newCount = updatedReviews.length;
      const newAvg = Number(
        (updatedReviews.reduce((sum, r) => sum + Number(r.rating || 5), 0) / newCount).toFixed(2)
      );
      await client.query(
        "UPDATE shopit_products SET reviews = $1, review_count = $2, rating = $3, updated_at = NOW() WHERE id = $4",
        [JSON.stringify(updatedReviews), newCount, newAvg, targetProductId]
      );
      await client.query(
        "UPDATE shopit_orders SET has_review = true, updated_at = NOW() WHERE id = $1",
        [id]
      );
      if (prod.seller_id) {
        const sellerProdsRes = await client.query(
          "SELECT rating, review_count FROM shopit_products WHERE seller_id = $1 AND review_count > 0",
          [prod.seller_id]
        );
        if (sellerProdsRes.rows.length > 0) {
          let totalWeight = 0;
          let weightedSum = 0;
          for (const sp of sellerProdsRes.rows) {
            const c = parseInt(String(sp.review_count || "0"), 10);
            const r = parseFloat(String(sp.rating || "5"));
            totalWeight += c;
            weightedSum += c * r;
          }
          if (totalWeight > 0) {
            const sellerAvg = Number((weightedSum / totalWeight).toFixed(2));
            await client.query(
              "UPDATE shopit_sellers SET rating = $1, updated_at = NOW() WHERE id = $2 OR user_id = $2",
              [sellerAvg, prod.seller_id]
            );
          }
        }
      }
      return {
        code: 201,
        body: {
          status: true,
          review: reviewEntry,
          rating: newAvg,
          reviewCount: newCount,
          productId: targetProductId,
          message: "Thank you for rating your artisan!"
        },
        audit: { orderId: id, productId: targetProductId, rating: numRating }
      };
    });
    if (txResult.code === 201 && txResult.audit) {
      await logAuditEvent({
        action: "ORDER_REVIEW_SUBMITTED",
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: "product", id: txResult.audit.productId },
        details: txResult.audit,
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
    }
    return res.status(txResult.code).json(txResult.body);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
async function processEscrowAutoRelease(batchLimit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(batchLimit)));
  try {
    const candidateRes = await query(
      `SELECT o.id FROM shopit_orders o
       LEFT JOIN shopit_disputes d ON d.order_id = o.id AND d.status IN ('open', 'investigating')
       WHERE o.status IN ('shipped', 'delivered')
         AND o.auto_release_at IS NOT NULL
         AND o.auto_release_at <= NOW()
         AND d.id IS NULL
       ORDER BY o.auto_release_at ASC
       LIMIT $1`,
      [safeLimit]
    );
    const releasedIds = [];
    for (const candidate of candidateRes.rows) {
      const released = await withTransaction(async (client) => {
        const orderRes = await client.query("SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE", [candidate.id]);
        if (orderRes.rows.length === 0) return false;
        const order = orderRes.rows[0];
        if (order.status !== "shipped" && order.status !== "delivered") return false;
        const disputeCheck = await client.query(
          `SELECT id FROM shopit_disputes WHERE order_id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
          [order.id]
        );
        if (disputeCheck.rows.length > 0) return false;
        const items = Array.isArray(order.items) ? order.items : [];
        const sellerTotals = {};
        for (const item of items) {
          if (item.sellerId) {
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const itemKobo = Math.round(Number(item.sellerPrice || 0) * 100) * qty;
            sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemKobo;
          }
        }
        for (const [sId, amountKobo] of Object.entries(sellerTotals)) {
          const wRes = await client.query(
            "SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
            [sId]
          );
          if (wRes.rows.length > 0) {
            const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || "0", 10);
            const currentAvailable = parseInt(wRes.rows[0].available_balance_kobo || "0", 10);
            const newPending = Math.max(0, currentPending - amountKobo);
            const newAvailable = currentAvailable + amountKobo;
            const idempotencyKey = `escrow_release:${order.id}:${sId}`;
            const ledgerIns = await client.query(
              `INSERT INTO shopit_ledger_entries (
                id, wallet_id, order_id, type, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES (
                $1, $2, $3, 'escrow_release', 'available', 'completed',
                $4, 0, $5, $6, $7, $8, NOW()
              )
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `ESCROW-AUTO-${order.id}-${sId.slice(-6)}`,
                sId,
                order.id,
                amountKobo,
                newAvailable,
                `5-Day Escrow auto-released for Order #${order.id}`,
                order.payment_reference || order.id,
                idempotencyKey
              ]
            );
            if (ledgerIns.rows.length > 0) {
              await client.query(
                `UPDATE shopit_wallets
                 SET pending_balance_kobo = $1,
                     available_balance_kobo = $2,
                     updated_at = NOW()
                 WHERE seller_id = $3`,
                [newPending, newAvailable, sId]
              );
            }
          }
        }
        const prevStatus = order.status;
        await client.query(
          `UPDATE shopit_orders
           SET status = 'completed',
               auto_release_at = NULL,
               completed_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [order.id]
        );
        await client.query(
          `INSERT INTO shopit_order_status_history (
            id, order_id, previous_status, new_status, changed_by, notes, created_at
          ) VALUES ($1, $2, $3, 'completed', 'escrow_auto_release_cron', 'Funds auto-released to seller after inspection period without dispute.', NOW())`,
          [`osh_auto_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`, order.id, prevStatus]
        );
        return true;
      });
      if (released) releasedIds.push(candidate.id);
    }
    return { releasedCount: releasedIds.length, orderIds: releasedIds };
  } catch (err) {
    console.warn("[Escrow Auto-Release Error]:", err.message);
    return { releasedCount: 0, orderIds: [] };
  }
}
__name(processEscrowAutoRelease, "processEscrowAutoRelease");
router.post("/escrow/auto-release", requireAdmin, async (req, res) => {
  const result = await processEscrowAutoRelease(50);
  const unshipped = await processUnshippedOrders(50);
  await logAuditEvent({
    action: "ADMIN_ESCROW_SCAN_TRIGGERED",
    actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
    target: { type: "escrow", id: "batch_scan" },
    details: {
      releasedCount: result.releasedCount,
      remindedCount: unshipped.remindedCount,
      refundedCount: unshipped.refundedCount
    },
    ip: req.ip,
    userAgent: req.get("user-agent")
  });
  return res.json({
    status: true,
    message: `Escrow scan completed. ${result.releasedCount} orders auto-released; ${unshipped.remindedCount} unshipped reminders; ${unshipped.refundedCount} Day-5 auto-refunds.`,
    ...result,
    unshipped
  });
});
router.get("/wallet", requirePaymentsEnabled2, requireAuth, async (req, res) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user;
    const requestedSellerId = req.query.sellerId ? String(req.query.sellerId).trim() : user.sellerId || user.userId;
    if (!isUserSellerOwner(user, requestedSellerId) && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "Forbidden." });
    }
    await query(
      `INSERT INTO shopit_wallets (seller_id, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, false, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (seller_id) DO NOTHING`,
      [requestedSellerId]
    );
    const walletRes = await query("SELECT * FROM shopit_wallets WHERE seller_id = $1", [requestedSellerId]);
    const walletRow = walletRes.rows[0];
    const ledgerRes = await query(
      "SELECT * FROM shopit_ledger_entries WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 100",
      [requestedSellerId]
    );
    const sellerMetaRes = await query(
      `SELECT s.under_18, s.guardian_name, u.age
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON u.id = s.user_id
       WHERE s.id = $1 OR s.user_id = $1 LIMIT 1`,
      [requestedSellerId]
    );
    const metaRow = sellerMetaRes.rows[0];
    const parsedAge = metaRow?.age !== null && metaRow?.age !== void 0 ? Number(metaRow.age) : null;
    const isMinorSeller = Boolean(metaRow?.under_18) || parsedAge !== null && parsedAge < 18;
    const pendingKobo = parseInt(walletRow.pending_balance_kobo || "0", 10);
    const availableKobo = parseInt(walletRow.available_balance_kobo || "0", 10);
    const withdrawnKobo = parseInt(walletRow.total_withdrawn_kobo || "0", 10);
    const ledgerEntries = ledgerRes.rows.map((row) => {
      const amountKobo = parseInt(row.amount_kobo || "0", 10);
      const feeKobo = parseInt(row.fee_kobo || "0", 10);
      const balanceAfterKobo = parseInt(row.balance_after_kobo || "0", 10);
      return {
        id: row.id,
        walletId: row.wallet_id,
        type: row.type,
        amount: koboToNaira(amountKobo),
        amountKobo,
        fee: koboToNaira(feeKobo),
        feeKobo,
        balanceAfter: koboToNaira(balanceAfterKobo),
        balanceAfterKobo,
        balanceType: row.balance_type,
        description: row.description,
        reference: row.reference,
        createdAt: row.created_at
      };
    });
    return res.json({
      status: true,
      wallet: {
        sellerId: walletRow.seller_id,
        pendingBalance: koboToNaira(pendingKobo),
        availableBalance: koboToNaira(availableKobo),
        totalWithdrawn: koboToNaira(withdrawnKobo),
        pendingBalanceKobo: pendingKobo,
        availableBalanceKobo: availableKobo,
        totalWithdrawnKobo: withdrawnKobo,
        isFrozen: Boolean(walletRow.is_frozen),
        freezeReason: walletRow.freeze_reason,
        isMinorSeller,
        dailyWithdrawalCap: isMinorSeller ? 25e3 : 3e5,
        guardianName: metaRow?.guardian_name || void 0,
        payoutAccounts: Array.isArray(walletRow.payout_accounts) ? walletRow.payout_accounts : [],
        activePayoutAccountId: walletRow.active_payout_account_id,
        ledger: ledgerEntries,
        transactions: ledgerEntries
      }
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/wallet/payout-account", requirePaymentsEnabled2, requireAuth, async (req, res) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user;
    const { bankCode, bankName, accountNumber, accountName, otpCode } = req.body;
    if (!bankCode || !/^[A-Za-z0-9]{3,12}$/.test(String(bankCode).trim())) {
      return res.status(400).json({ status: false, message: "A valid Nigerian bank code is required." });
    }
    if (!bankName || !accountNumber || !/^\d{10}$/.test(String(accountNumber).trim())) {
      return res.status(400).json({ status: false, message: "Valid bank name and 10-digit account number are required." });
    }
    if (!otpCode) {
      return res.status(400).json({ status: false, message: "Email OTP authorization code is required to link a payout account." });
    }
    const flwSecret = (process.env.FLW_SECRET_KEY || "").trim().replace(/^["']|["']$/g, "");
    if (!flwSecret) {
      return res.status(503).json({
        status: false,
        error: "PAYMENT_GATEWAY_NOT_CONFIGURED",
        message: "Bank account resolution is unavailable because FLW_SECRET_KEY is not configured."
      });
    }
    const otpCheck = await verifyAndConsumeOtp(user.email, "payout_account", String(otpCode).trim());
    if (!otpCheck.success) {
      return res.status(403).json({ status: false, message: otpCheck.error || "Invalid or expired authorization code." });
    }
    const cleanBankCode = String(bankCode).trim();
    const cleanAccountNumber = String(accountNumber).trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    let resolveRes;
    let resolveData;
    try {
      resolveRes = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          account_number: cleanAccountNumber,
          account_bank: cleanBankCode
        }),
        signal: controller.signal
      });
      resolveData = await resolveRes.json().catch(() => ({}));
    } catch (err) {
      return res.status(502).json({ status: false, message: `Bank account verification error: ${err.message}` });
    } finally {
      clearTimeout(timeout);
    }
    if (!resolveRes.ok || resolveData?.status !== "success" || !resolveData?.data?.account_name) {
      return res.status(400).json({
        status: false,
        message: resolveData?.message || "Could not resolve this bank account number with Flutterwave."
      });
    }
    const resolvedAccountName = String(resolveData.data.account_name).trim().toUpperCase();
    const sellerId = user.sellerId || user.userId;
    const sellerRes = await query(
      `SELECT s.verification_status, s.verified_legal_name, s.guardian_name, s.guardian_consent, s.under_18, u.age
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON u.id = s.user_id
       WHERE s.id = $1 OR s.user_id = $2`,
      [sellerId, user.userId]
    );
    const sellerRow = sellerRes.rows[0];
    const parsedAge = sellerRow?.age !== null && sellerRow?.age !== void 0 ? Number(sellerRow.age) : null;
    const isMinorSeller = Boolean(sellerRow?.under_18) || parsedAge !== null && parsedAge < 18;
    const isSellerVerified = sellerRow?.verification_status === "verified" || sellerRow?.verification_status === "approved";
    if (!isSellerVerified && user.role !== "admin") {
      return res.status(403).json({
        status: false,
        message: "Complete NIN identity verification before linking a payout bank account."
      });
    }
    if (isMinorSeller && (!sellerRow?.guardian_name || !sellerRow?.guardian_consent)) {
      return res.status(403).json({
        status: false,
        message: "Under-18 sellers must submit verified parent/guardian identity and signed consent before linking a guardian payout account."
      });
    }
    const expectedLegalName = isMinorSeller ? String(sellerRow.guardian_name).trim() : String(sellerRow?.verified_legal_name || user.name).trim();
    const resolvedTokens = resolvedAccountName.toLowerCase().split(/\s+/).filter(Boolean);
    const legalTokens = expectedLegalName.toLowerCase().split(/\s+/).filter(Boolean);
    const overlap = resolvedTokens.filter((t) => t.length >= 2 && legalTokens.includes(t)).length;
    const requiredMatches = legalTokens.length >= 2 ? 2 : 1;
    if (overlap < requiredMatches && user.role !== "admin") {
      return res.status(403).json({
        status: false,
        message: isMinorSeller ? `Under-18 payout account holder (${resolvedAccountName}) must match your guardian's verified ID name (${expectedLegalName}).` : `Resolved bank account name (${resolvedAccountName}) must match verified identity (${expectedLegalName}).`
      });
    }
    await query(
      `INSERT INTO shopit_wallets (seller_id, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, false, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (seller_id) DO NOTHING`,
      [sellerId]
    );
    const wRes = await query("SELECT payout_accounts FROM shopit_wallets WHERE seller_id = $1", [sellerId]);
    const currentAccounts = wRes.rows.length > 0 && Array.isArray(wRes.rows[0].payout_accounts) ? wRes.rows[0].payout_accounts : [];
    const newAccount = {
      id: `acc_${Date.now()}`,
      bankCode: cleanBankCode,
      bankName: String(bankName).trim(),
      accountNumber: cleanAccountNumber,
      accountName: resolvedAccountName || String(accountName || "").trim().toUpperCase(),
      isVerified: true,
      isMinorGuardianAccount: isMinorSeller,
      guardianName: isMinorSeller ? expectedLegalName : void 0,
      adminApproved: !isMinorSeller,
      coolingPeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const updatedAccounts = [...currentAccounts, newAccount];
    await query(
      `UPDATE shopit_wallets
       SET payout_accounts = $1,
           active_payout_account_id = COALESCE(active_payout_account_id, $2),
           updated_at = NOW()
       WHERE seller_id = $3`,
      [JSON.stringify(updatedAccounts), newAccount.id, sellerId]
    );
    await logAuditEvent({
      action: isMinorSeller ? "MINOR_GUARDIAN_PAYOUT_ACCOUNT_LINKED" : "PAYOUT_ACCOUNT_LINKED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "wallet", id: sellerId },
      details: {
        bankName: newAccount.bankName,
        bankCode: newAccount.bankCode,
        last4: newAccount.accountNumber.slice(-4),
        isMinorGuardianAccount: isMinorSeller,
        adminApproved: newAccount.adminApproved
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      account: newAccount,
      message: isMinorSeller ? "Guardian payout account verified via Flutterwave. Requires one-time Admin approval and 24-hour cooling period before withdrawals." : "Payout account verified via Flutterwave and added with 24-hour cooling period."
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
function mapConversationRow(row, userMap, unreadStats, isBlocked = false) {
  const buyerMeta = row.buyer_id ? userMap?.get(row.buyer_id) : void 0;
  const sellerMeta = row.seller_id ? userMap?.get(row.seller_id) : void 0;
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productTitle: row.product_title || (row.order_id ? `Order #${row.order_id}` : "Marketplace Craft Inquiry"),
    productImage: row.product_image || void 0,
    buyerId: row.buyer_id,
    buyerDisplayName: buyerMeta?.displayName || row.buyer_masked_id || extractFirstName(row.buyer_name || "Member"),
    buyerAvatarUrl: buyerMeta?.avatarUrl,
    buyerProfileSlug: buyerMeta?.profileSlug,
    sellerId: row.seller_id,
    sellerShopName: row.seller_shop_name || sellerMeta?.displayName || "Artisan",
    sellerDisplayName: sellerMeta?.displayName || row.seller_shop_name || "Artisan",
    sellerAvatarUrl: sellerMeta?.avatarUrl,
    sellerProfileSlug: sellerMeta?.profileSlug,
    lastMessage: row.last_message || "Conversation started",
    lastMessageAt: row.last_message_at || row.created_at,
    unreadBuyer: unreadStats ? unreadStats.unreadBuyer : 0,
    unreadSeller: unreadStats ? unreadStats.unreadSeller : 0,
    isChatLocked: Boolean(row.is_chat_locked),
    isBlocked,
    bypassViolationsCount: parseInt(row.bypass_violations_count, 10) || 0,
    createdAt: row.created_at
  };
}
__name(mapConversationRow, "mapConversationRow");
async function computeConversationUnreadAndBlocks(convRows, userMap) {
  const unreadMap = /* @__PURE__ */ new Map();
  const blockedConvSet = /* @__PURE__ */ new Set();
  if (convRows.length === 0) return { unreadMap, blockedConvSet };
  const convIds = convRows.map((c) => c.id).filter(Boolean);
  const { placeholders, params } = buildInClause(convIds);
  const msgRes = await query(
    `SELECT conversation_id, sender_id, sender_role, created_at
     FROM shopit_chat_messages
     WHERE conversation_id IN (${placeholders})`,
    params
  ).catch(() => ({ rows: [] }));
  const msgsByConv = /* @__PURE__ */ new Map();
  for (const m of msgRes.rows) {
    const list = msgsByConv.get(m.conversation_id) || [];
    list.push(m);
    msgsByConv.set(m.conversation_id, list);
  }
  for (const conv of convRows) {
    const msgs = msgsByConv.get(conv.id) || [];
    const buyerReadMs = conv.buyer_last_read_at ? new Date(conv.buyer_last_read_at).getTime() : 0;
    const sellerReadMs = conv.seller_last_read_at ? new Date(conv.seller_last_read_at).getTime() : 0;
    let unreadBuyer = 0;
    let unreadSeller = 0;
    for (const m of msgs) {
      const mMs = new Date(m.created_at).getTime();
      if (m.sender_id !== conv.buyer_id && mMs > buyerReadMs) {
        unreadBuyer++;
      }
      if (m.sender_id === conv.buyer_id && mMs > sellerReadMs) {
        unreadSeller++;
      }
    }
    unreadMap.set(conv.id, { unreadBuyer, unreadSeller });
  }
  const allParticipantUserIds = Array.from(
    new Set(
      convRows.flatMap((c) => [c.buyer_id, userMap.get(c.seller_id)?.id || c.seller_id]).filter(Boolean)
    )
  );
  if (allParticipantUserIds.length > 0) {
    const bIn = buildInClause(allParticipantUserIds);
    const blkRes = await query(
      `SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id IN (${bIn.placeholders}) OR blocked_id IN (${bIn.placeholders})`,
      bIn.params
    ).catch(() => ({ rows: [] }));
    const blockPairs = new Set(blkRes.rows.map((r) => `${r.blocker_id}:${r.blocked_id}`));
    for (const conv of convRows) {
      const sellerUserId = userMap.get(conv.seller_id)?.id || conv.seller_id;
      if (blockPairs.has(`${conv.buyer_id}:${sellerUserId}`) || blockPairs.has(`${sellerUserId}:${conv.buyer_id}`)) {
        blockedConvSet.add(conv.id);
      }
    }
  }
  return { unreadMap, blockedConvSet };
}
__name(computeConversationUnreadAndBlocks, "computeConversationUnreadAndBlocks");
router.get("/chat/conversations", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const sellerLookup = user.sellerId || user.userId;
    const result = user.role === "admin" ? await query(`SELECT * FROM shopit_chat_conversations ORDER BY last_message_at DESC NULLS LAST, created_at DESC LIMIT 100`) : await query(
      `SELECT * FROM shopit_chat_conversations
             WHERE buyer_id = $1 OR seller_id = $1 OR seller_id = $2
             ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
      [user.userId, sellerLookup]
    );
    const ids = [];
    for (const r of result.rows) {
      if (r.buyer_id) ids.push(r.buyer_id);
      if (r.seller_id) ids.push(r.seller_id);
    }
    const userMap = await batchLoadUserMeta(ids);
    const { unreadMap, blockedConvSet } = await computeConversationUnreadAndBlocks(result.rows, userMap);
    const conversations = result.rows.map(
      (r) => mapConversationRow(r, userMap, unreadMap.get(r.id), blockedConvSet.has(r.id))
    );
    return res.json({ status: true, conversations });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/chat/unread-count", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const sellerLookup = user.sellerId || user.userId;
    const countRes = await query(
      `SELECT COUNT(*)::int AS unread_count
       FROM shopit_chat_messages m
       JOIN shopit_chat_conversations c ON c.id = m.conversation_id
       WHERE (c.buyer_id = $1 AND m.sender_id != c.buyer_id AND m.created_at > COALESCE(c.buyer_last_read_at, '1970-01-01T00:00:00Z'::timestamptz))
          OR ((c.seller_id = $1 OR c.seller_id = $2) AND m.sender_id = c.buyer_id AND m.created_at > COALESCE(c.seller_last_read_at, '1970-01-01T00:00:00Z'::timestamptz))`,
      [user.userId, sellerLookup]
    );
    return res.json({
      status: true,
      unreadCount: Number(countRes.rows[0]?.unread_count || 0)
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Unable to fetch unread message count." });
  }
});
router.post("/chat/conversations", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { sellerId, productId, productTitle, productImage, orderId } = req.body || {};
    if (!sellerId) {
      return res.status(400).json({ status: false, message: "sellerId is required." });
    }
    if (isUserSellerOwner(user, String(sellerId))) {
      return res.status(400).json({ status: false, message: "You cannot open a chat conversation with your own shop." });
    }
    const sellerRes = await query(
      `SELECT s.id, s.user_id, s.shop_name, s.under_18 as s_under_18,
              u.id as u_id, u.age, u.privacy_settings, u.is_banned, u.deleted_at
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
       WHERE s.id = $1 OR s.user_id = $1
       LIMIT 1`,
      [sellerId]
    );
    let targetUserRow = sellerRes.rows[0];
    if (!targetUserRow) {
      const fallbackUserRes = await query(
        "SELECT id as u_id, age, privacy_settings, is_banned, deleted_at FROM shopit_users WHERE id = $1 LIMIT 1",
        [sellerId]
      );
      if (fallbackUserRes.rows[0]) {
        targetUserRow = fallbackUserRes.rows[0];
      }
    }
    if (!targetUserRow || targetUserRow.deleted_at || targetUserRow.is_banned) {
      return res.status(404).json({ status: false, message: "This seller account is unavailable." });
    }
    const canonicalSellerId = targetUserRow.id || String(sellerId);
    const sellerUserId = targetUserRow.user_id || targetUserRow.u_id || canonicalSellerId;
    if (sellerUserId === user.userId || isUserSellerOwner(user, canonicalSellerId)) {
      return res.status(400).json({ status: false, message: "You cannot open a chat conversation with your own shop." });
    }
    const shopName = targetUserRow.shop_name || "Artisan";
    if (user.role !== "admin") {
      const blkRes = await query(
        `SELECT id FROM shopit_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [user.userId, sellerUserId]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, message: "You cannot message this user because one of you has blocked the other." });
      }
    }
    const cleanProductId = productId ? String(productId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;
    let verifiedProduct = null;
    if (cleanProductId) {
      const prodRes = await query(
        `SELECT id, seller_id, title, images, is_draft
         FROM shopit_products
         WHERE id = $1
         LIMIT 1`,
        [cleanProductId]
      );
      const pRow = prodRes.rows[0];
      if (!pRow || pRow.is_draft) {
        return res.status(404).json({ status: false, message: "Referenced product listing was not found." });
      }
      if (pRow.seller_id !== canonicalSellerId && pRow.seller_id !== sellerUserId) {
        return res.status(403).json({ status: false, message: "That product does not belong to this seller." });
      }
      verifiedProduct = { id: pRow.id, title: pRow.title, images: pRow.images };
    }
    let verifiedOrderId = null;
    if (cleanOrderId) {
      const ordRes = await query(
        `SELECT id, buyer_id, items FROM shopit_orders WHERE id = $1 LIMIT 1`,
        [cleanOrderId]
      );
      const oRow = ordRes.rows[0];
      if (!oRow) {
        return res.status(404).json({ status: false, message: "Referenced order was not found." });
      }
      const orderItems = Array.isArray(oRow.items) ? oRow.items : typeof oRow.items === "string" ? (() => {
        try {
          return JSON.parse(oRow.items);
        } catch {
          return [];
        }
      })() : [];
      const involvesSeller = orderItems.some(
        (it) => it?.sellerId === canonicalSellerId || it?.sellerId === sellerUserId
      );
      if (oRow.buyer_id !== user.userId && user.role !== "admin" || !involvesSeller) {
        return res.status(403).json({ status: false, message: "You are not authorized to chat on this order." });
      }
      verifiedOrderId = oRow.id;
    }
    const existingOrderRes = verifiedOrderId ? null : await query(
      `SELECT id FROM shopit_orders
           WHERE buyer_id = $1 AND (items::text LIKE $2 OR items::text LIKE $3)
           ORDER BY created_at DESC LIMIT 1`,
      [user.userId, `%"sellerId":"${canonicalSellerId}"%`, `%"sellerId":"${sellerUserId}"%`]
    );
    const hasExistingOrder = Boolean(verifiedOrderId || existingOrderRes?.rows?.length);
    const buyerAgeRes = await query("SELECT age FROM shopit_users WHERE id = $1 LIMIT 1", [user.userId]);
    const buyerIsUnder18 = isMinorAccount({ age: buyerAgeRes.rows[0]?.age });
    const sellerIsUnder18 = isMinorAccount({ age: targetUserRow.age, sellerUnder18: targetUserRow.s_under_18 });
    const minorChatGate = evaluateMinorChatStart({
      sellerIsUnder18,
      buyerIsUnder18,
      hasVerifiedProduct: Boolean(verifiedProduct),
      hasVerifiedOrder: hasExistingOrder,
      isAdmin: user.role === "admin"
    });
    if (!minorChatGate.allowed) {
      return res.status(403).json({
        status: false,
        message: minorChatGate.reason
      });
    }
    if (user.role !== "admin" && !sellerIsUnder18 && !buyerIsUnder18) {
      const basePrivacy = DEFAULT_PRIVACY_SETTINGS;
      const rawPrivacy = typeof targetUserRow.privacy_settings === "string" ? (() => {
        try {
          return JSON.parse(targetUserRow.privacy_settings);
        } catch {
          return basePrivacy;
        }
      })() : targetUserRow.privacy_settings || basePrivacy;
      const privacy = sanitizePrivacySettings(rawPrivacy, basePrivacy, false);
      if (privacy.whoCanMessage !== "everyone" && !hasExistingOrder) {
        const [fViewerToTarget, fTargetToViewer] = await Promise.all([
          query(`SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`, [user.userId, sellerUserId]),
          query(`SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`, [sellerUserId, user.userId])
        ]);
        const viewerFollows = fViewerToTarget.rows.length > 0;
        const targetFollows = fTargetToViewer.rows.length > 0;
        if (privacy.whoCanMessage === "followers" && !viewerFollows) {
          return res.status(403).json({
            status: false,
            message: "This member only accepts messages from followers or customers with an order."
          });
        }
        if (privacy.whoCanMessage === "mutual" && !(viewerFollows && targetFollows)) {
          return res.status(403).json({
            status: false,
            message: "This member only accepts messages from mutual followers or customers with an order."
          });
        }
      }
    }
    let resolvedTitle = verifiedProduct?.title || (productTitle ? String(productTitle).trim().slice(0, 200) : null);
    let resolvedImage = productImage ? String(productImage).trim() : null;
    if (verifiedProduct && !resolvedImage && Array.isArray(verifiedProduct.images) && verifiedProduct.images[0]) {
      resolvedImage = verifiedProduct.images[0];
    }
    const userMap = await batchLoadUserMeta([user.userId, canonicalSellerId, sellerUserId]);
    const buyerDisplayName = userMap.get(user.userId)?.displayName || extractFirstName(user.name || "Member");
    const effectiveOrderId = verifiedOrderId || existingOrderRes?.rows?.[0]?.id || null;
    const existing = await query(
      `SELECT * FROM shopit_chat_conversations
       WHERE buyer_id = $1 AND (seller_id = $2 OR seller_id = $3)
       ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
      [user.userId, String(sellerId), canonicalSellerId]
    );
    if (existing.rows.length > 0) {
      let existingRow = existing.rows[0];
      if (verifiedProduct?.id || effectiveOrderId || resolvedTitle) {
        const upd = await query(
          `UPDATE shopit_chat_conversations
           SET product_id = COALESCE($1, product_id),
               product_title = COALESCE($2, product_title),
               product_image = COALESCE($3, product_image),
               order_id = COALESCE($4, order_id),
               seller_shop_name = COALESCE($5, seller_shop_name),
               buyer_masked_id = COALESCE($6, buyer_masked_id)
           WHERE id = $7
           RETURNING *`,
          [verifiedProduct?.id || null, resolvedTitle, resolvedImage, effectiveOrderId, shopName, buyerDisplayName, existingRow.id]
        );
        if (upd.rows.length > 0) existingRow = upd.rows[0];
      }
      const { unreadMap, blockedConvSet } = await computeConversationUnreadAndBlocks([existingRow], userMap);
      return res.json({
        status: true,
        conversation: mapConversationRow(existingRow, userMap, unreadMap.get(existingRow.id), blockedConvSet.has(existingRow.id))
      });
    }
    const convId = `conv_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`;
    const insertRes = await query(
      `INSERT INTO shopit_chat_conversations (
        id, order_id, product_id, product_title, product_image,
        buyer_id, buyer_masked_id, seller_id, seller_shop_name,
        last_message, last_message_at, buyer_last_read_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Chat started', NOW(), NOW(), NOW())
      RETURNING *`,
      [convId, effectiveOrderId, verifiedProduct?.id || null, resolvedTitle, resolvedImage, user.userId, buyerDisplayName, canonicalSellerId, shopName]
    );
    await logAuditEvent({
      action: "CHAT_CONVERSATION_STARTED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "conversation", id: convId },
      details: { sellerId: canonicalSellerId, shopName, productId: verifiedProduct?.id || null, productTitle: resolvedTitle, orderId: effectiveOrderId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({
      status: true,
      conversation: mapConversationRow(insertRes.rows[0], userMap, { unreadBuyer: 0, unreadSeller: 0 }, false)
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/chat/conversations/:id/read", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const convRes = await query("SELECT * FROM shopit_chat_conversations WHERE id = $1 LIMIT 1", [id]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Conversation not found." });
    }
    const conv = convRes.rows[0];
    const isBuyer = conv.buyer_id === user.userId;
    const isSeller = isUserSellerOwner(user, conv.seller_id);
    if (!isBuyer && !isSeller && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "Access denied to this conversation." });
    }
    let updatedConv = conv;
    if (isBuyer) {
      const upd = await query(
        "UPDATE shopit_chat_conversations SET buyer_last_read_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );
      if (upd.rows[0]) updatedConv = upd.rows[0];
    } else if (isSeller) {
      const upd = await query(
        "UPDATE shopit_chat_conversations SET seller_last_read_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );
      if (upd.rows[0]) updatedConv = upd.rows[0];
    }
    const userMap = await batchLoadUserMeta([conv.buyer_id, conv.seller_id]);
    const { unreadMap } = await computeConversationUnreadAndBlocks([updatedConv], userMap);
    const counts = unreadMap.get(id) || { unreadBuyer: 0, unreadSeller: 0 };
    return res.json({ status: true, conversationId: id, ...counts });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/chat/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const rl = await checkAndRecordRateLimit(`chat_poll:${user.userId}`, 60, 60 * 1e3);
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSeconds || 10));
      return res.status(429).json({ status: false, message: "Polling too quickly. Slowing down requests." });
    }
    const { id } = req.params;
    const convRes = await query("SELECT * FROM shopit_chat_conversations WHERE id = $1", [id]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Conversation not found." });
    }
    const conv = convRes.rows[0];
    if (conv.buyer_id !== user.userId && !isUserSellerOwner(user, conv.seller_id) && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "Access denied to this conversation." });
    }
    const afterId = req.query.afterId ? String(req.query.afterId).trim() : "";
    let afterCreatedAt = req.query.afterCreatedAt ? String(req.query.afterCreatedAt).trim() : "";
    let anchorDbCreatedAt = null;
    if (afterId) {
      const anchorRes = await query(
        "SELECT created_at FROM shopit_chat_messages WHERE conversation_id = $1 AND id = $2 LIMIT 1",
        [id, afterId]
      );
      if (anchorRes.rows[0]?.created_at) {
        anchorDbCreatedAt = anchorRes.rows[0].created_at;
        afterCreatedAt = new Date(anchorRes.rows[0].created_at).toISOString();
      }
    }
    const hasCursor = Boolean(anchorDbCreatedAt || afterCreatedAt && !Number.isNaN(Date.parse(afterCreatedAt)));
    const cursorTimestamp = anchorDbCreatedAt || afterCreatedAt;
    const result = hasCursor ? await query(
      `SELECT * FROM shopit_chat_messages
           WHERE conversation_id = $1
             AND (created_at > $2::timestamptz OR (created_at = $2::timestamptz AND id > $3))
             AND id != $3
           ORDER BY created_at ASC, id ASC
           LIMIT 200`,
      [id, cursorTimestamp, afterId || "__none__"]
    ) : await query(
      "SELECT * FROM shopit_chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC LIMIT 200",
      [id]
    );
    if (result.rows.length === 0) {
      return res.json({ status: true, messages: [], hasNew: false });
    }
    const senderMap = await batchLoadUserMeta([conv.buyer_id, conv.seller_id, ...result.rows.map((r) => r.sender_id)]);
    const buyerReadMs = conv.buyer_last_read_at ? new Date(conv.buyer_last_read_at).getTime() : 0;
    const sellerReadMs = conv.seller_last_read_at ? new Date(conv.seller_last_read_at).getTime() : 0;
    return res.json({
      status: true,
      hasNew: true,
      messages: result.rows.map((row) => {
        const sMeta = row.sender_id ? senderMap.get(row.sender_id) : void 0;
        const senderDisplayName = row.sender_role === "admin" ? "Shop It Moderation" : sMeta?.displayName || row.sender_masked_name || "Member";
        const msgMs = new Date(row.created_at).getTime();
        const isSentByBuyer = row.sender_id === conv.buyer_id;
        const readByOther = isSentByBuyer ? sellerReadMs >= msgMs : buyerReadMs >= msgMs;
        const parsedAttachment = row.attachment && typeof row.attachment === "string" ? (() => {
          try {
            return JSON.parse(row.attachment);
          } catch {
            return void 0;
          }
        })() : row.attachment || void 0;
        return {
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          senderRole: row.sender_role,
          senderDisplayName,
          senderAvatarUrl: sMeta?.avatarUrl,
          senderProfileSlug: sMeta?.profileSlug,
          content: row.content,
          attachment: parsedAttachment,
          readByOther,
          isBlockedBypass: Boolean(row.is_blocked_bypass),
          presetOffer: row.preset_offer || void 0,
          createdAt: row.created_at,
          timestamp: row.created_at
        };
      })
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/chat/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const check = rejectUnknownFields(req.body || {}, ["content", "presetOffer", "attachment"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { content, presetOffer, attachment } = check.obj;
    const convRes = await query("SELECT * FROM shopit_chat_conversations WHERE id = $1", [id]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Conversation not found." });
    }
    const conv = convRes.rows[0];
    if (conv.buyer_id !== user.userId && !isUserSellerOwner(user, conv.seller_id) && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "Access denied to this conversation." });
    }
    if (conv.is_chat_locked) {
      return res.status(403).json({ status: false, message: "This conversation has been locked by moderation." });
    }
    const sellerOwnerRes = await query(
      `SELECT s.user_id, s.under_18 as s_under_18, u.age as u_age
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
       WHERE s.id = $1 OR s.user_id = $1
       LIMIT 1`,
      [conv.seller_id]
    );
    const sellerUserId = sellerOwnerRes.rows[0]?.user_id || conv.seller_id;
    const [buyerAgeRow, sellerAgeRow] = await Promise.all([
      query("SELECT age FROM shopit_users WHERE id = $1 LIMIT 1", [conv.buyer_id]),
      sellerOwnerRes.rows[0] ? Promise.resolve({ rows: [sellerOwnerRes.rows[0]] }) : query("SELECT age as u_age FROM shopit_users WHERE id = $1 LIMIT 1", [sellerUserId])
    ]);
    const buyerIsUnder18 = isMinorAccount({ age: buyerAgeRow.rows[0]?.age });
    const sellerIsUnder18 = isMinorAccount({
      age: sellerAgeRow.rows[0]?.u_age,
      sellerUnder18: sellerAgeRow.rows[0]?.s_under_18
    });
    const minorMsgGate = evaluateMinorMessageSend({
      sellerIsUnder18,
      buyerIsUnder18,
      conversationProductId: conv.product_id,
      conversationOrderId: conv.order_id,
      isAdmin: user.role === "admin"
    });
    if (!minorMsgGate.allowed) {
      return res.status(403).json({ status: false, message: minorMsgGate.reason });
    }
    if (user.role !== "admin") {
      const blkRes = await query(
        `SELECT id FROM shopit_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [conv.buyer_id, sellerUserId]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, message: "Messaging is disabled because one participant has blocked the other." });
      }
    }
    let attachmentMeta;
    if (attachment && typeof attachment === "object" && attachment.fileId) {
      const fileId = String(attachment.fileId).trim();
      const fRes = await query(
        "SELECT id, owner_id, original_name, mime_type, size_bytes, conversation_id FROM shopit_files WHERE id = $1 LIMIT 1",
        [fileId]
      );
      if (fRes.rows.length === 0) {
        return res.status(400).json({ status: false, message: "Attached file was not found." });
      }
      const fRow = fRes.rows[0];
      if (fRow.owner_id !== user.userId && user.role !== "admin") {
        return res.status(403).json({ status: false, message: "You can only attach files that you uploaded." });
      }
      if (fRow.conversation_id && fRow.conversation_id !== id) {
        return res.status(403).json({ status: false, message: "This file is attached to a different conversation." });
      }
      await query("UPDATE shopit_files SET conversation_id = $1, is_public = false WHERE id = $2", [id, fileId]);
      attachmentMeta = {
        id: fRow.id,
        url: `/api/files/${fRow.id}`,
        originalName: fRow.original_name,
        mimeType: fRow.mime_type,
        sizeBytes: Number(fRow.size_bytes || 0),
        kind: String(fRow.mime_type || "").startsWith("image/") ? "image" : "document"
      };
    }
    const sanitizedPresetOffer = presetOffer && typeof presetOffer === "object" && Number.isFinite(Number(presetOffer.price)) && Number.isFinite(Number(presetOffer.quantity)) ? {
      price: Math.max(100, Math.round(Number(presetOffer.price))),
      quantity: Math.max(1, Math.min(100, Math.round(Number(presetOffer.quantity)))),
      title: presetOffer.title ? String(presetOffer.title).trim().slice(0, 120) : void 0
    } : void 0;
    const cleanContent = content !== void 0 && content !== null ? String(content).trim().slice(0, 1e3) : "";
    if (!cleanContent && !attachmentMeta && !sanitizedPresetOffer) {
      return res.status(400).json({ status: false, message: "Message text or an attachment is required." });
    }
    const phoneRegex = /(\+?234|0)[789][01]\d{8}/;
    const bankRegex = /\b\d{10}\b/;
    const whatsappRegex = /(wa\.me|whatsapp|t\.me|telegram|ig\s*dm|dm\s*me\s*on\s*ig|instagram|snapchat|call\s*me|opay|palmpay|kuda|acct\s*no|account\s*number)/i;
    const freeTextDigitRegex = !sanitizedPresetOffer ? /\d/ : /$^/;
    const isBypass = Boolean(
      cleanContent && (phoneRegex.test(cleanContent) || bankRegex.test(cleanContent) || whatsappRegex.test(cleanContent) || freeTextDigitRegex.test(cleanContent))
    );
    const msgId = `msg_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`;
    const role = isUserSellerOwner(user, conv.seller_id) ? "seller" : user.role === "admin" ? "admin" : "buyer";
    const senderMap = await batchLoadUserMeta([user.userId]);
    const sMeta = senderMap.get(user.userId);
    const senderDisplayName = role === "seller" ? conv.seller_shop_name || sMeta?.displayName || "Artisan" : role === "admin" ? "Shop It Moderation" : sMeta?.displayName || extractFirstName(user.name || "Member");
    const savedContent = isBypass ? "[Security Notice: Numbers, phone numbers, account numbers, and off-platform contact details are prohibited in chat.]" : cleanContent;
    const savedAttachment = isBypass ? void 0 : attachmentMeta;
    const lastMessagePreview = savedContent ? savedContent : savedAttachment ? `[Attachment: ${savedAttachment.originalName}]` : "[Custom Offer]";
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const insRes = await query(
      `INSERT INTO shopit_chat_messages (
        id, conversation_id, sender_id, sender_role, sender_masked_name,
        content, is_blocked_bypass, preset_offer, attachment, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
      RETURNING created_at`,
      [
        msgId,
        id,
        user.userId,
        role,
        senderDisplayName,
        savedContent,
        isBypass,
        sanitizedPresetOffer ? JSON.stringify(sanitizedPresetOffer) : null,
        savedAttachment ? JSON.stringify(savedAttachment) : null,
        nowIso
      ]
    );
    const storedCreatedAt = insRes.rows[0]?.created_at ? new Date(insRes.rows[0].created_at).toISOString() : nowIso;
    const nextViolations = (parseInt(conv.bypass_violations_count, 10) || 0) + (isBypass ? 1 : 0);
    const readCursorColumn = conv.buyer_id === user.userId ? "buyer_last_read_at" : "seller_last_read_at";
    await query(
      `UPDATE shopit_chat_conversations
       SET last_message = $1, last_message_at = NOW(),
           bypass_violations_count = $2,
           is_chat_locked = CASE WHEN $2 >= 2 THEN true ELSE is_chat_locked END,
           ${readCursorColumn} = NOW()
       WHERE id = $3`,
      [lastMessagePreview.slice(0, 200), nextViolations, id]
    );
    try {
      const recipientUserId = role === "buyer" ? sellerUserId : conv.buyer_id;
      if (recipientUserId && recipientUserId !== user.userId) {
        const muteCheck = await query(
          "SELECT 1 FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2 LIMIT 1",
          [recipientUserId, user.userId]
        );
        if (muteCheck.rows.length === 0) {
          const notifTitle = `New Message from ${senderDisplayName}`;
          const notifBody = isBypass ? "A blocked safety notice was logged in your conversation." : lastMessagePreview.slice(0, 140);
          await query(
            `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
             VALUES ($1, $2, $3, $4, 'info', false, '/chat', NOW())`,
            [
              `notif_chat_${Date.now()}_${crypto8.randomBytes(2).toString("hex")}`,
              recipientUserId,
              notifTitle,
              notifBody
            ]
          );
          const recRes = await query(
            "SELECT email, display_name, name, notification_prefs FROM shopit_users WHERE id = $1 LIMIT 1",
            [recipientUserId]
          );
          const recRow = recRes.rows[0];
          const rawPrefs = typeof recRow?.notification_prefs === "string" ? JSON.parse(recRow.notification_prefs) : recRow?.notification_prefs;
          const prefs = sanitizeNotificationPrefs(rawPrefs || DEFAULT_NOTIFICATION_PREFS);
          if (prefs.emailMessages && recRow?.email && !String(recRow.email).endsWith(".local")) {
            const recName = recRow.display_name || extractFirstName(recRow.name || "Friend");
            sendBrevoDirect(
              recRow.email,
              notifTitle,
              `Hi ${recName},

${senderDisplayName} sent you a message on Shop It: "${notifBody}"`,
              `<p>Hi ${recName},</p><p><strong>${senderDisplayName}</strong> sent you a message on Shop It:</p><blockquote>${notifBody}</blockquote>`,
              recName
            ).catch(() => {
            });
          }
        }
      }
    } catch {
    }
    await logAuditEvent({
      action: isBypass ? "CHAT_BYPASS_BLOCKED" : "CHAT_MESSAGE_SENT",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "conversation", id },
      details: {
        senderRole: role,
        isBlockedBypass: isBypass,
        hasAttachment: Boolean(savedAttachment),
        violationsCount: nextViolations,
        preview: isBypass ? "[Off-platform contact blocked]" : lastMessagePreview.slice(0, 80)
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({
      status: true,
      message: {
        id: msgId,
        conversationId: id,
        senderId: user.userId,
        senderRole: role,
        senderDisplayName,
        senderAvatarUrl: sMeta?.avatarUrl,
        senderProfileSlug: sMeta?.profileSlug,
        content: savedContent,
        attachment: savedAttachment,
        readByOther: false,
        isBlockedBypass: isBypass,
        presetOffer: sanitizedPresetOffer,
        createdAt: storedCreatedAt,
        timestamp: storedCreatedAt
      },
      isChatLocked: nextViolations >= 2 || Boolean(conv.is_chat_locked),
      bypassViolationsCount: nextViolations,
      warning: isBypass ? "Anti-bypass trigger: Personal contact info or numbers redacted for marketplace safety." : void 0
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/disputes", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const sellerLookup = user.sellerId || user.userId;
    const result = user.role === "admin" ? await query("SELECT * FROM shopit_disputes ORDER BY created_at DESC") : await query(
      "SELECT * FROM shopit_disputes WHERE buyer_id = $1 OR seller_id = $1 OR seller_id = $2 ORDER BY created_at DESC",
      [user.userId, sellerLookup]
    );
    const ids = [];
    for (const r of result.rows) {
      if (r.buyer_id) ids.push(r.buyer_id);
      if (r.seller_id) ids.push(r.seller_id);
    }
    const userMap = await batchLoadUserMeta(ids);
    return res.json({
      status: true,
      disputes: result.rows.map((row) => {
        const bMeta = row.buyer_id ? userMap.get(row.buyer_id) : void 0;
        const sMeta = row.seller_id ? userMap.get(row.seller_id) : void 0;
        return {
          id: row.id,
          orderId: row.order_id,
          sellerId: row.seller_id,
          buyerId: row.buyer_id,
          buyerDisplayName: bMeta?.displayName || row.buyer_masked_id || extractFirstName(row.buyer_name || "Buyer"),
          buyerAvatarUrl: bMeta?.avatarUrl,
          buyerProfileSlug: bMeta?.profileSlug,
          sellerShopName: row.seller_shop_name,
          sellerDisplayName: sMeta?.displayName || row.seller_shop_name,
          sellerAvatarUrl: sMeta?.avatarUrl,
          sellerProfileSlug: sMeta?.profileSlug,
          reason: row.reason,
          description: row.description,
          amountHeldInEscrow: koboToNaira(row.amount_held_in_escrow_kobo || 0),
          amountHeldInEscrowKobo: Number(row.amount_held_in_escrow_kobo || 0),
          evidencePhotoUrl: row.evidence_photo_url,
          sellerPackedPhotoUrl: row.seller_packed_photo_url,
          status: row.status,
          resolutionNotes: row.resolution_notes,
          createdAt: row.created_at
        };
      })
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/disputes", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { orderId, reason, description, evidencePhotoUrl } = req.body;
    if (!orderId || !reason) {
      return res.status(400).json({ status: false, message: "orderId and reason are required." });
    }
    if (evidencePhotoUrl !== void 0 && evidencePhotoUrl !== null && String(evidencePhotoUrl).trim() !== "" && !isValidImageSource(evidencePhotoUrl)) {
      return res.status(400).json({ status: false, message: "Invalid dispute evidence image format." });
    }
    const oRes = await query("SELECT * FROM shopit_orders WHERE id = $1", [orderId]);
    if (oRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Order not found." });
    }
    const order = oRes.rows[0];
    const items = Array.isArray(order.items) ? order.items : [];
    const isParticipant = order.buyer_id === user.userId || items.some((i) => isUserSellerOwner(user, i.sellerId)) || user.role === "admin";
    if (!isParticipant) {
      return res.status(403).json({ status: false, message: "Only participants of this order may open a dispute." });
    }
    const sellerId = items[0]?.sellerId;
    if (!sellerId) {
      return res.status(400).json({ status: false, message: "Order has no associated seller for dispute tracking." });
    }
    const sellerShopName = items[0]?.sellerShopName || "Artisan";
    const disputeId = `DISP-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const buyerMetaMap = await batchLoadUserMeta([order.buyer_id || user.userId]);
    const buyerDisplayName = buyerMetaMap.get(order.buyer_id || user.userId)?.displayName || extractFirstName(order.buyer_name || "Buyer");
    const escrowHeldKobo = Number(order.grand_total_kobo || 0);
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO shopit_disputes (
          id, order_id, seller_id, buyer_id, buyer_masked_id, seller_shop_name,
          reason, description, amount_held_in_escrow_kobo, evidence_photo_url,
          seller_packed_photo_url, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', NOW(), NOW())`,
        [
          disputeId,
          orderId,
          sellerId,
          order.buyer_id || user.userId,
          buyerDisplayName,
          sellerShopName,
          String(reason).trim().slice(0, 200),
          String(description || "").trim().slice(0, 1e3),
          escrowHeldKobo,
          evidencePhotoUrl || null,
          order.packed_photo_url || null
        ]
      );
      await client.query("UPDATE shopit_orders SET status = 'disputed', updated_at = NOW() WHERE id = $1", [orderId]);
      await client.query(
        `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
         VALUES ($1, $2, $3, 'disputed', $4, $5, NOW())`,
        [`osh_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`, orderId, order.status, user.userId, `Dispute filed: ${String(reason).slice(0, 120)}`]
      );
    });
    await logAuditEvent({
      action: "DISPUTE_OPENED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "dispute", id: disputeId },
      details: { orderId, sellerId, sellerShopName, reason: String(reason).trim().slice(0, 200), amountHeldInEscrow: koboToNaira(escrowHeldKobo) },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({ status: true, disputeId, message: "Dispute opened. Held funds are paused until moderation resolves the case." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.patch("/disputes/:id/resolve", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { resolution, partialRefundAmount, notes } = req.body || {};
    if (!["refund_full", "release_seller", "partial"].includes(String(resolution))) {
      return res.status(400).json({ status: false, message: "resolution must be refund_full, release_seller, or partial." });
    }
    const txResult = await withTransaction(async (client) => {
      const dispRes = await client.query("SELECT * FROM shopit_disputes WHERE id = $1 FOR UPDATE", [id]);
      if (dispRes.rows.length === 0) {
        return { code: 404, body: { status: false, message: "Dispute not found." } };
      }
      const disp = dispRes.rows[0];
      if (disp.status !== "open" && disp.status !== "investigating") {
        return { code: 409, body: { status: false, message: `Dispute is already ${disp.status}.` } };
      }
      const escrowKobo = Math.max(0, Number(disp.amount_held_in_escrow_kobo || 0));
      let refundKobo = 0;
      let sellerKobo = 0;
      let nextDisputeStatus = "resolved_released";
      let nextOrderStatus = "completed";
      if (resolution === "refund_full") {
        refundKobo = escrowKobo;
        sellerKobo = 0;
        nextDisputeStatus = "resolved_refunded";
        nextOrderStatus = "cancelled";
      } else if (resolution === "release_seller") {
        refundKobo = 0;
        sellerKobo = escrowKobo;
        nextDisputeStatus = "resolved_released";
        nextOrderStatus = "completed";
      } else {
        const reqRefundKobo = partialRefundAmount !== void 0 ? nairaToKobo(partialRefundAmount) : Math.round(escrowKobo / 2);
        refundKobo = Math.max(0, Math.min(escrowKobo, reqRefundKobo));
        sellerKobo = Math.max(0, escrowKobo - refundKobo);
        nextDisputeStatus = "resolved_partial";
        nextOrderStatus = "completed";
      }
      const cleanNotes = notes ? String(notes).trim().slice(0, 500) : `Resolved by ${user.email} (${resolution})`;
      await client.query(
        "UPDATE shopit_disputes SET status = $1, resolution_notes = $2, updated_at = NOW() WHERE id = $3",
        [nextDisputeStatus, cleanNotes, id]
      );
      if (disp.order_id) {
        const ordRes = await client.query("SELECT status FROM shopit_orders WHERE id = $1 FOR UPDATE", [disp.order_id]);
        if (ordRes.rows.length > 0) {
          const prevStatus = ordRes.rows[0].status;
          await client.query(
            `UPDATE shopit_orders
             SET status = $1,
                 completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
                 updated_at = NOW()
             WHERE id = $2`,
            [nextOrderStatus, disp.order_id]
          );
          await client.query(
            `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              `osh_${Date.now()}_${crypto8.randomBytes(3).toString("hex")}`,
              disp.order_id,
              prevStatus,
              nextOrderStatus,
              user.userId,
              cleanNotes
            ]
          );
        }
      }
      if (disp.seller_id) {
        const wRes = await client.query(
          "SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
          [disp.seller_id]
        );
        if (wRes.rows.length > 0) {
          const curPending = parseInt(wRes.rows[0].pending_balance_kobo || "0", 10);
          const curAvailable = parseInt(wRes.rows[0].available_balance_kobo || "0", 10);
          const nextPending = Math.max(0, curPending - escrowKobo);
          const nextAvailable = curAvailable + sellerKobo;
          const idempKey = `dispute_resolve:${id}:${disp.seller_id}`;
          const ledgerType = resolution === "refund_full" ? "refund" : "escrow_release";
          const ledgerAmtKobo = resolution === "refund_full" ? refundKobo : sellerKobo;
          const insRes = await client.query(
            `INSERT INTO shopit_ledger_entries (
              id, wallet_id, order_id, type, balance_type, status,
              amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
            ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, 0, $7, $8, $9, $10, NOW())
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id`,
            [
              `DISP-LED-${Date.now()}-${crypto8.randomBytes(2).toString("hex")}`,
              disp.seller_id,
              disp.order_id,
              ledgerType,
              resolution === "refund_full" ? "pending" : "available",
              ledgerAmtKobo,
              nextAvailable,
              `Dispute #${id} resolved (${resolution}): ${cleanNotes}`,
              disp.order_id,
              idempKey
            ]
          );
          if (insRes.rows.length > 0) {
            await client.query(
              `UPDATE shopit_wallets
               SET pending_balance_kobo = $1, available_balance_kobo = $2, updated_at = NOW()
               WHERE seller_id = $3`,
              [nextPending, nextAvailable, disp.seller_id]
            );
          }
        }
      }
      return {
        code: 200,
        body: {
          status: true,
          disputeId: id,
          disputeStatus: nextDisputeStatus,
          orderStatus: nextOrderStatus,
          refundNaira: koboToNaira(refundKobo),
          sellerNaira: koboToNaira(sellerKobo),
          resolutionNotes: cleanNotes,
          message: `Dispute ${id} resolved (${resolution}) and saved to database.`
        },
        audit: { disputeId: id, orderId: disp.order_id, resolution, refundKobo, sellerKobo }
      };
    });
    if (txResult.code === 200 && txResult.audit) {
      await logAuditEvent({
        action: "DISPUTE_RESOLVED",
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: "dispute", id },
        details: txResult.audit,
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
    }
    return res.status(txResult.code).json(txResult.body);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.patch("/admin/wallets/:sellerId/freeze", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const { sellerId } = req.params;
    const isFrozen = Boolean(req.body?.isFrozen);
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 300) : null;
    const sellerCheck = await query("SELECT id FROM shopit_sellers WHERE id = $1", [sellerId]);
    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Seller not found." });
    }
    await query(
      `INSERT INTO shopit_wallets (seller_id, is_frozen, freeze_reason, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (seller_id) DO UPDATE SET is_frozen = $2, freeze_reason = $3, updated_at = NOW()`,
      [sellerId, isFrozen, isFrozen ? reason || "Admin Security Review" : null]
    );
    await logAuditEvent({
      action: "WALLET_FREEZE_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "wallet", id: sellerId },
      details: { isFrozen, reason },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, sellerId, isFrozen, message: isFrozen ? "Wallet frozen in database." : "Wallet unfrozen in database." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.patch("/admin/chat/conversations/:id/lock", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const locked = req.body?.isChatLocked !== void 0 ? Boolean(req.body.isChatLocked) : true;
    const upd = await query(
      "UPDATE shopit_chat_conversations SET is_chat_locked = $1 WHERE id = $2 RETURNING id",
      [locked, id]
    );
    await logAuditEvent({
      action: "CHAT_LOCK_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "conversation", id },
      details: { isChatLocked: locked, matchedRows: upd.rows.length },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, conversationId: id, isChatLocked: locked });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const result = await query(
      "SELECT * FROM shopit_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [user.userId]
    );
    const unreadCount = result.rows.filter((r) => !r.is_read).length;
    return res.json({
      status: true,
      unreadCount,
      notifications: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type,
        isRead: Boolean(row.is_read),
        link: row.link,
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    await query(
      "UPDATE shopit_notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
      [user.userId]
    );
    return res.json({ status: true, unreadCount: 0, message: "All notifications marked as read." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const upd = await query(
      "UPDATE shopit_notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, user.userId]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Notification not found." });
    }
    return res.json({ status: true, message: "Notification marked as read." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.get("/commissions", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const sellerLookup = user.sellerId || user.userId;
    const result = user.role === "admin" ? await query("SELECT * FROM shopit_commissions ORDER BY created_at DESC LIMIT 100") : await query(
      `SELECT * FROM shopit_commissions
             WHERE buyer_id = $1 OR seller_id = $1 OR seller_id = $2
             ORDER BY created_at DESC`,
      [user.userId, sellerLookup]
    );
    return res.json({
      status: true,
      commissions: result.rows.map((row) => ({
        id: row.id,
        buyerId: row.buyer_id,
        buyerName: row.buyer_name,
        sellerId: row.seller_id,
        sellerShopName: row.seller_shop_name,
        title: row.title,
        description: row.description,
        budget: koboToNaira(row.budget_kobo || 0),
        budgetKobo: parseInt(row.budget_kobo || "0", 10),
        status: row.status,
        milestones: Array.isArray(row.milestones) ? row.milestones : [],
        reference: row.reference,
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router.post("/commissions", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { sellerId, title, description, budget } = req.body;
    if (!sellerId || !title || !budget) {
      return res.status(400).json({ status: false, message: "sellerId, title, and budget are required." });
    }
    if (isUserSellerOwner(user, String(sellerId))) {
      return res.status(400).json({ status: false, message: "You cannot submit a custom commission to your own shop." });
    }
    const budgetKobo = nairaToKobo(budget);
    if (budgetKobo < 1e4) {
      return res.status(400).json({ status: false, message: "Minimum custom commission budget is \u20A6100." });
    }
    const sellerRes = await query("SELECT shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1", [sellerId]);
    if (sellerRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Seller not found." });
    }
    const shopName = sellerRes.rows[0]?.shop_name || "Artisan";
    const commId = `COMM-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    await query(
      `INSERT INTO shopit_commissions (
        id, buyer_id, buyer_name, seller_id, seller_shop_name,
        title, description, budget_kobo, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())`,
      [commId, user.userId, user.name, sellerId, shopName, String(title).trim().slice(0, 200), String(description || "").slice(0, 1500), budgetKobo]
    );
    await logAuditEvent({
      action: "COMMISSION_REQUESTED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "commission", id: commId },
      details: { sellerId, shopName, title: String(title).trim().slice(0, 120), budgetNaira: koboToNaira(budgetKobo) },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({ status: true, commissionId: commId, message: "Commission request submitted." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
var marketplace_default = router;

// server/routes/profiles.ts
import express2 from "express";
import crypto9 from "crypto";
init_validation();
init_minorSafety();
var router2 = express2.Router();
function parseJsonSafe(val, fallback) {
  if (val === null || val === void 0) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val;
}
__name(parseJsonSafe, "parseJsonSafe");
function buildInClause2(values, startIndex = 1) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return { placeholders: "$1", params: ["__none__"] };
  return {
    placeholders: unique.map((_, i) => `$${startIndex + i}`).join(", "),
    params: unique
  };
}
__name(buildInClause2, "buildInClause");
function mapProductRow(row, sellerDisplayName, sellerAvatarUrl, sellerProfileSlug) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerShopName: row.seller_shop_name || sellerDisplayName || "Artisan Shop",
    sellerDisplayName: sellerDisplayName || row.seller_shop_name || "Artisan",
    sellerAvatarUrl: sellerAvatarUrl || void 0,
    sellerProfileSlug: sellerProfileSlug || void 0,
    sellerCampus: row.seller_campus || "Lagos Mainland",
    location: {
      state: row.location_state || "Lagos",
      city: row.location_city || "Lagos Mainland",
      area: row.location_area || "Yaba"
    },
    locationArea: row.location_area || "Yaba",
    sellerBadges: Array.isArray(row.seller_badges) ? row.seller_badges : parseJsonSafe(row.seller_badges, []),
    title: row.title,
    description: row.description || "",
    category: row.category || "crafts",
    sellerPrice: Math.round(Number(row.seller_price_kobo || 0)) / 100,
    serviceFee: Math.round(Number(row.service_fee_kobo || 0)) / 100,
    displayPrice: Math.round(Number(row.display_price_kobo || 0)) / 100,
    images: Array.isArray(row.images) ? row.images : parseJsonSafe(row.images, []),
    stock: parseInt(String(row.stock ?? 0), 10) || 0,
    rating: parseFloat(row.rating || 5),
    reviewCount: parseInt(String(row.review_count ?? 0), 10) || 0,
    reviews: Array.isArray(row.reviews) ? row.reviews : parseJsonSafe(row.reviews, []),
    delivery: {
      allowsPickup: true,
      pickupLocation: `${row.location_area || "Hub"} Campus Pickup Spot`,
      pickupFee: Math.round(Number(row.delivery_pickup_fee_kobo || 0)) / 100,
      allowsLocalDelivery: true,
      localDeliveryFee: row.delivery_local_fee_kobo !== void 0 && row.delivery_local_fee_kobo !== null ? Math.round(Number(row.delivery_local_fee_kobo)) / 100 : 500,
      minOrderForDelivery: 1e3
    },
    isSoldOut: Boolean(row.is_sold_out || Number(row.stock || 0) <= 0),
    isNewArrival: Boolean(row.is_new_arrival),
    isPaused: Boolean(row.is_paused),
    isDraft: Boolean(row.is_draft),
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at || void 0,
    createdAt: row.created_at
  };
}
__name(mapProductRow, "mapProductRow");
function computeProfileCompleteness(params) {
  const items = [
    { key: "avatar", label: "Add a profile photo", done: Boolean(params.avatarUrl), targetField: "avatar" },
    {
      key: "tagline",
      label: "Add a short tagline",
      done: Boolean(params.tagline && params.tagline.trim().length >= 5),
      targetField: "tagline"
    },
    { key: "bio", label: "Write a short bio", done: Boolean(params.bio && params.bio.trim().length >= 10), targetField: "bio" },
    {
      key: "location",
      label: "Set your state & area",
      done: Boolean(params.locationState || params.campus || params.locationArea),
      targetField: "location"
    },
    {
      key: "interests",
      label: "Pick at least 1 craft interest",
      done: params.interests.length > 0,
      targetField: "interests"
    }
  ];
  if (params.isSeller) {
    items.push({
      key: "shop_story",
      label: "Share your shop story",
      done: Boolean(params.shopStory && params.shopStory.trim().length >= 15),
      targetField: "shopStory"
    });
    items.push({
      key: "first_product",
      label: "Publish at least 1 craft listing",
      done: params.activeProductsCount > 0,
      targetField: "firstProduct"
    });
  }
  const doneCount = items.filter((i) => i.done).length;
  const score = Math.round(doneCount / items.length * 100);
  return { score, items };
}
__name(computeProfileCompleteness, "computeProfileCompleteness");
async function computeComputedSellerStats(userRow, sellerRow, activeProducts, allProducts) {
  const [followersRes, followingRes, ordersRes] = await Promise.all([
    query("SELECT COUNT(*) as total FROM shopit_follows WHERE following_id = $1 AND status = 'accepted'", [userRow.id]),
    query("SELECT COUNT(*) as total FROM shopit_follows WHERE follower_id = $1 AND status = 'accepted'", [userRow.id]),
    sellerRow ? query(
      `SELECT status, created_at, paid_at, shipped_at, items
           FROM shopit_orders
           WHERE items::text LIKE $1 OR items::text LIKE $2`,
      [`%"sellerId":"${userRow.id}"%`, `%"sellerId":"${sellerRow.id}"%`]
    ) : query(
      `SELECT status, created_at, paid_at, shipped_at, items
           FROM shopit_orders
           WHERE buyer_id = $1`,
      [userRow.id]
    )
  ]);
  const followersCount = parseInt(String(followersRes.rows[0]?.total || "0"), 10);
  const followingCount = parseInt(String(followingRes.rows[0]?.total || "0"), 10);
  const completedStatuses = /* @__PURE__ */ new Set(["delivered", "completed"]);
  const completedOrdersCount = ordersRes.rows.filter((o) => completedStatuses.has(String(o.status))).length;
  const shippedOrders = ordersRes.rows.filter((o) => Boolean(o.shipped_at));
  let isFastShipper = false;
  if (shippedOrders.length >= 1) {
    const diffs = shippedOrders.map((o) => {
      const startMs = new Date(o.paid_at || o.created_at).getTime();
      const shipMs = new Date(o.shipped_at).getTime();
      return shipMs - startMs;
    }).filter((ms) => Number.isFinite(ms) && ms >= 0);
    if (diffs.length > 0) {
      const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      if (avgMs <= 24 * 60 * 60 * 1e3) {
        isFastShipper = true;
      }
    }
  }
  const rawReviews = [];
  for (const p of activeProducts) {
    const pRevs = Array.isArray(p.reviews) ? p.reviews : parseJsonSafe(p.reviews, []);
    for (const r of pRevs) {
      rawReviews.push({
        ...r,
        productId: p.id,
        productTitle: p.title
      });
    }
  }
  const reviewerIds = Array.from(new Set(rawReviews.map((r) => r.reviewerId).filter(Boolean)));
  const reviewerMap = /* @__PURE__ */ new Map();
  if (reviewerIds.length > 0) {
    const { placeholders, params } = buildInClause2(reviewerIds);
    const uRes = await query(
      `SELECT id, name, display_name, avatar_url, profile_slug, deleted_at
       FROM shopit_users
       WHERE id IN (${placeholders})`,
      params
    ).catch(() => ({ rows: [] }));
    for (const ur of uRes.rows) {
      if (ur.deleted_at) {
        reviewerMap.set(ur.id, { displayName: "Deleted User" });
      } else {
        reviewerMap.set(ur.id, {
          displayName: ur.display_name || extractFirstName(ur.name || "Member"),
          avatarUrl: ur.avatar_url || void 0,
          profileSlug: ur.profile_slug || void 0
        });
      }
    }
  }
  const enrichedReviews = rawReviews.map((r) => {
    const revInfo = r.reviewerId ? reviewerMap.get(r.reviewerId) : void 0;
    const displayName = revInfo?.displayName || r.reviewerName || "Verified Shopper";
    return {
      id: r.id,
      productId: r.productId,
      productTitle: r.productTitle,
      reviewerId: r.reviewerId || void 0,
      reviewerName: displayName,
      reviewerAvatarUrl: revInfo?.avatarUrl || r.reviewerAvatarUrl || void 0,
      reviewerProfileSlug: revInfo?.profileSlug || r.reviewerProfileSlug || void 0,
      rating: Number(r.rating || 5),
      comment: String(r.comment || ""),
      date: r.date || "",
      verifiedPurchase: Boolean(r.verifiedPurchase ?? true)
    };
  });
  const reviewCount = enrichedReviews.length;
  const averageRating = reviewCount > 0 ? Number((enrichedReviews.reduce((s, r) => s + Number(r.rating || 5), 0) / reviewCount).toFixed(2)) : sellerRow ? parseFloat(String(sellerRow.rating || 5)) : 0;
  const isVerifiedSeller = Boolean(
    sellerRow && (sellerRow.is_verified_seller || sellerRow.verification_status === "verified" || sellerRow.verification_status === "approved")
  );
  const computedBadges = [];
  if (sellerRow) {
    if (isVerifiedSeller) {
      computedBadges.push({ id: "verified", label: "Verified Seller" });
    }
    if (isFastShipper) {
      computedBadges.push({ id: "fast_shipper", label: "Fast Shipper" });
    }
    if (reviewCount >= 3 && averageRating >= 4.5) {
      computedBadges.push({ id: "top_rated", label: "Top Rated" });
    }
    const joinedMs = new Date(sellerRow.created_at || userRow.created_at || Date.now()).getTime();
    if (completedOrdersCount < 3 && Date.now() - joinedMs <= 30 * 24 * 60 * 60 * 1e3) {
      computedBadges.push({ id: "new_seller", label: "New Seller" });
    }
  }
  return {
    followersCount,
    followingCount,
    completedOrdersCount,
    productsCount: activeProducts.length,
    totalProductsCount: allProducts.length,
    reviewCount,
    averageRating,
    reviews: enrichedReviews,
    isVerifiedSeller,
    badges: computedBadges
  };
}
__name(computeComputedSellerStats, "computeComputedSellerStats");
router2.get("/profiles/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const uRes = await query(
      `SELECT u.*, s.id as s_id, s.shop_name, s.bio as s_bio, s.shop_story, s.craft_materials,
              s.processing_time, s.delivery_options, s.campus as s_campus, s.location_area as s_area,
              s.location_state as s_state, s.location_city as s_city,
              s.logo_url as s_logo_url, s.banner_url as s_banner_url,
              s.is_verified_seller, s.verification_status, s.under_18 as s_under_18,
              s.vacation_mode, s.created_at as s_created_at, s.rating as s_rating
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.id = $1`,
      [userId]
    );
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Profile not found." });
    }
    const row = uRes.rows[0];
    const displayName = row.display_name || extractFirstName(row.name || "Member");
    const isUnder18 = row.age !== null && row.age !== void 0 && Number(row.age) < 18 || Boolean(row.s_under_18);
    const interests = parseJsonSafe(row.interests, []);
    const languages = parseJsonSafe(row.languages, []);
    const deliveryOptions = parseJsonSafe(row.delivery_options, { allowsPickup: true, allowsLocalDelivery: true, pickupSpots: [] });
    const notificationPrefs = sanitizeNotificationPrefs(parseJsonSafe(row.notification_prefs, DEFAULT_NOTIFICATION_PREFS));
    const privacySettings = sanitizePrivacySettings(
      parseJsonSafe(row.privacy_settings, isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS),
      isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS,
      isUnder18
    );
    const sellerRow = row.s_id ? {
      id: row.s_id,
      shop_name: row.shop_name,
      bio: row.s_bio,
      shop_story: row.shop_story,
      craft_materials: row.craft_materials,
      processing_time: row.processing_time,
      delivery_options: {
        allowsPickup: deliveryOptions?.allowsPickup !== false,
        allowsLocalDelivery: deliveryOptions?.allowsLocalDelivery !== false,
        pickupSpots: Array.isArray(deliveryOptions?.pickupSpots) ? deliveryOptions.pickupSpots : []
      },
      campus: row.s_campus,
      location_area: row.s_area,
      location_state: row.s_state,
      location_city: row.s_city,
      logo_url: row.s_logo_url,
      banner_url: row.s_banner_url,
      is_verified_seller: row.is_verified_seller,
      verification_status: row.verification_status,
      vacation_mode: row.vacation_mode,
      created_at: row.s_created_at,
      rating: row.s_rating
    } : null;
    const prodIds = sellerRow ? [row.id, sellerRow.id] : [row.id];
    const prodIn = buildInClause2(prodIds);
    const pRes = await query(
      `SELECT * FROM shopit_products WHERE seller_id IN (${prodIn.placeholders}) ORDER BY is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC`,
      prodIn.params
    );
    const activeProds = pRes.rows.filter((p) => !p.is_paused && !p.is_draft);
    const stats = await computeComputedSellerStats(row, sellerRow, activeProds, pRes.rows);
    const pendingReqRes = await query(
      `SELECT COUNT(*) as total
       FROM shopit_follows f
       JOIN shopit_users fu ON fu.id = f.follower_id
       WHERE f.following_id = $1 AND f.status = 'pending' AND fu.deleted_at IS NULL AND fu.is_banned IS NOT TRUE`,
      [row.id]
    ).catch(() => ({ rows: [{ total: 0 }] }));
    const pendingFollowRequestsCount = parseInt(String(pendingReqRes.rows[0]?.total || "0"), 10);
    const completeness = computeProfileCompleteness({
      avatarUrl: row.avatar_url || sellerRow?.logo_url,
      tagline: row.tagline,
      bio: row.bio || sellerRow?.bio,
      locationState: row.location_state || sellerRow?.location_state,
      campus: row.campus || sellerRow?.campus,
      locationArea: row.location_area || sellerRow?.location_area,
      interests,
      isVerifiedEmail: Boolean(row.is_verified_email),
      isSeller: Boolean(sellerRow),
      shopName: sellerRow?.shop_name,
      shopStory: sellerRow?.shop_story,
      activeProductsCount: activeProds.length
    });
    return res.json({
      status: true,
      profile: {
        id: row.id,
        email: row.email,
        fullName: row.name,
        displayName,
        profileSlug: row.profile_slug,
        canonicalSlug: row.profile_slug,
        tagline: row.tagline || "",
        role: row.role,
        avatarUrl: row.avatar_url || sellerRow?.logo_url || null,
        coverUrl: row.cover_url || sellerRow?.banner_url || null,
        bio: row.bio || "",
        locationState: row.location_state || sellerRow?.location_state || "",
        campus: row.campus || sellerRow?.campus || "",
        locationArea: row.location_area || sellerRow?.location_area || "",
        interests,
        languages,
        isVerifiedEmail: Boolean(row.is_verified_email),
        isUnder18,
        memberSince: row.created_at,
        lastSeenAt: row.last_seen_at || row.last_login_at || row.created_at,
        notificationPrefs,
        privacySettings,
        completeness,
        pendingFollowRequestsCount,
        ...stats,
        products: pRes.rows.map(
          (p) => mapProductRow(p, displayName, row.avatar_url || sellerRow?.logo_url, row.profile_slug)
        ),
        seller: sellerRow ? {
          id: sellerRow.id,
          shopName: sellerRow.shop_name,
          bio: sellerRow.bio || "",
          shopStory: sellerRow.shop_story || "",
          craftMaterials: sellerRow.craft_materials || "",
          processingTime: sellerRow.processing_time || "",
          deliveryOptions: sellerRow.delivery_options,
          locationState: sellerRow.location_state || row.location_state || "Lagos",
          campus: sellerRow.campus || "Lagos Mainland",
          locationArea: sellerRow.location_area || "Yaba",
          logoUrl: sellerRow.logo_url || row.avatar_url || null,
          bannerUrl: sellerRow.banner_url || row.cover_url || null,
          isVerifiedSeller: stats.isVerifiedSeller,
          verificationStatus: sellerRow.verification_status || "not_started",
          vacationMode: Boolean(sellerRow.vacation_mode)
        } : null
      }
    });
  } catch (err) {
    console.error("[GET /profiles/me Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to load your profile." });
  }
});
router2.patch("/profiles/me", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, [
      "displayName",
      "tagline",
      "avatarUrl",
      "coverUrl",
      "bio",
      "locationState",
      "campus",
      "locationArea",
      "interests",
      "languages",
      "shopName",
      "shopBio",
      "shopStory",
      "craftMaterials",
      "processingTime",
      "deliveryOptions",
      "vacationMode",
      "logoUrl",
      "bannerUrl",
      "privacySettings"
    ]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const body = check.obj;
    const userId = req.user.userId;
    let nextDisplayName;
    if ("displayName" in body) {
      const cleaned = String(body.displayName || "").trim().replace(/\s+/g, " ");
      if (cleaned.length < 2 || cleaned.length > 40) {
        return res.status(400).json({ status: false, message: "Display name must be between 2 and 40 characters." });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Display name: ${contactCheck.reason}` });
      }
      nextDisplayName = cleaned;
    }
    let nextTagline;
    if ("tagline" in body) {
      const cleaned = String(body.tagline || "").trim().replace(/\s+/g, " ");
      if (cleaned.length > MAX_TAGLINE_LENGTH) {
        return res.status(400).json({
          status: false,
          message: `Tagline must be ${MAX_TAGLINE_LENGTH} characters or fewer.`
        });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Tagline: ${contactCheck.reason}` });
      }
      nextTagline = cleaned;
    }
    let nextBio;
    if ("bio" in body) {
      const cleaned = String(body.bio || "").trim();
      if (cleaned.length > MAX_BIO_LENGTH) {
        return res.status(400).json({
          status: false,
          message: `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`
        });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Bio: ${contactCheck.reason}` });
      }
      nextBio = cleaned;
    }
    let nextShopName;
    if ("shopName" in body && body.shopName !== void 0 && body.shopName !== null) {
      const cleaned = String(body.shopName).trim();
      if (cleaned.length < 2 || cleaned.length > 120) {
        return res.status(400).json({ status: false, message: "Shop name must be between 2 and 120 characters." });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Shop name: ${contactCheck.reason}` });
      }
      nextShopName = cleaned;
    }
    let nextShopBio;
    if ("shopBio" in body && body.shopBio !== void 0 && body.shopBio !== null) {
      const cleaned = String(body.shopBio).trim();
      if (cleaned.length > 1e3) {
        return res.status(400).json({ status: false, message: "Shop bio must be 1000 characters or fewer." });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Shop bio: ${contactCheck.reason}` });
      }
      nextShopBio = cleaned;
    }
    let nextShopStory;
    if ("shopStory" in body && body.shopStory !== void 0 && body.shopStory !== null) {
      const cleaned = String(body.shopStory).trim();
      if (cleaned.length > MAX_SHOP_STORY_LENGTH) {
        return res.status(400).json({
          status: false,
          message: `Shop story must be ${MAX_SHOP_STORY_LENGTH} characters or fewer.`
        });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Shop story: ${contactCheck.reason}` });
      }
      nextShopStory = cleaned;
    }
    let nextCraftMaterials;
    if ("craftMaterials" in body && body.craftMaterials !== void 0 && body.craftMaterials !== null) {
      const cleaned = String(body.craftMaterials).trim();
      if (cleaned.length > MAX_CRAFT_MATERIALS_LENGTH) {
        return res.status(400).json({
          status: false,
          message: `Craft & materials must be ${MAX_CRAFT_MATERIALS_LENGTH} characters or fewer.`
        });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Craft & materials: ${contactCheck.reason}` });
      }
      nextCraftMaterials = cleaned;
    }
    let nextProcessingTime;
    if ("processingTime" in body && body.processingTime !== void 0 && body.processingTime !== null) {
      const cleaned = String(body.processingTime).trim();
      const allowedProcSet = new Set(PROCESSING_TIME_OPTIONS);
      if (cleaned !== "" && !allowedProcSet.has(cleaned)) {
        return res.status(400).json({ status: false, message: "Invalid processing time selection." });
      }
      nextProcessingTime = cleaned;
    }
    let nextDeliveryOptions;
    if ("deliveryOptions" in body && body.deliveryOptions !== void 0 && body.deliveryOptions !== null) {
      const dCheck = sanitizeDeliveryOptions(body.deliveryOptions);
      if (!dCheck.valid) {
        return res.status(400).json({ status: false, message: dCheck.message });
      }
      nextDeliveryOptions = dCheck.value;
    }
    let nextVacationMode;
    if ("vacationMode" in body && body.vacationMode !== void 0) {
      nextVacationMode = Boolean(body.vacationMode);
    }
    let nextLocationState;
    if ("locationState" in body) {
      const cleaned = String(body.locationState || "").trim().slice(0, 60);
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `State: ${contactCheck.reason}` });
      }
      nextLocationState = cleaned;
    }
    let nextCampus;
    if ("campus" in body) {
      const cleaned = String(body.campus || "").trim().slice(0, 120);
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Campus: ${contactCheck.reason}` });
      }
      nextCampus = cleaned;
    }
    let nextArea;
    if ("locationArea" in body) {
      const cleaned = String(body.locationArea || "").trim().slice(0, 100);
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Location area: ${contactCheck.reason}` });
      }
      nextArea = cleaned;
    }
    let nextInterests;
    if ("interests" in body) {
      if (!Array.isArray(body.interests)) {
        return res.status(400).json({ status: false, message: "Interests must be a list of allowed tags." });
      }
      const allowedSet = new Set(PROFILE_INTERESTS);
      const deduped = [];
      for (const item of body.interests) {
        const s = String(item || "").trim();
        if (!allowedSet.has(s)) {
          return res.status(400).json({ status: false, message: `Invalid interest tag: "${s}".` });
        }
        if (!deduped.includes(s)) deduped.push(s);
      }
      nextInterests = deduped.slice(0, 10);
    }
    let nextLanguages;
    if ("languages" in body) {
      if (!Array.isArray(body.languages)) {
        return res.status(400).json({ status: false, message: "Languages must be a list of allowed options." });
      }
      const allowedLangSet = new Set(ALLOWED_LANGUAGES);
      const dedupedLangs = [];
      for (const item of body.languages) {
        const s = String(item || "").trim();
        if (!allowedLangSet.has(s)) {
          return res.status(400).json({ status: false, message: `Invalid language option: "${s}".` });
        }
        if (!dedupedLangs.includes(s)) dedupedLangs.push(s);
      }
      nextLanguages = dedupedLangs.slice(0, 6);
    }
    let nextAvatarUrl;
    if ("avatarUrl" in body) {
      const img = validateAndSanitizeImageInput(body.avatarUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextAvatarUrl = img.url;
    }
    let nextCoverUrl;
    if ("coverUrl" in body) {
      const img = validateAndSanitizeImageInput(body.coverUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextCoverUrl = img.url;
    }
    let nextLogoUrl;
    if ("logoUrl" in body) {
      const img = validateAndSanitizeImageInput(body.logoUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextLogoUrl = img.url;
    }
    let nextBannerUrl;
    if ("bannerUrl" in body) {
      const img = validateAndSanitizeImageInput(body.bannerUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextBannerUrl = img.url;
    }
    const updated = await withTransaction(async (client) => {
      const uRes = await client.query("SELECT * FROM shopit_users WHERE id = $1 FOR UPDATE", [userId]);
      if (uRes.rows.length === 0) return null;
      const current = uRes.rows[0];
      const sRes = await client.query("SELECT * FROM shopit_sellers WHERE user_id = $1 OR id = $1 LIMIT 1", [userId]);
      const sRow = sRes.rows[0] || null;
      let nextSlug = current.profile_slug;
      let previousSlug;
      if (nextDisplayName && nextDisplayName !== current.display_name) {
        nextSlug = await generateUniqueProfileSlug(
          (sql, p) => client.query(sql, p),
          nextDisplayName,
          userId
        );
        if (current.profile_slug && nextSlug.toLowerCase() !== String(current.profile_slug).toLowerCase()) {
          previousSlug = String(current.profile_slug).toLowerCase();
          await client.query(
            `INSERT INTO shopit_profile_slug_history (slug, user_id, created_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (slug) DO UPDATE SET user_id = EXCLUDED.user_id, created_at = NOW()`,
            [previousSlug, userId]
          );
          await client.query("DELETE FROM shopit_profile_slug_history WHERE LOWER(slug) = LOWER($1)", [nextSlug]);
        }
      }
      const isUnder18 = current.age !== null && current.age !== void 0 && Number(current.age) < 18 || Boolean(sRow?.under_18);
      const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
      const currentPrivacy = sanitizePrivacySettings(
        parseJsonSafe(current.privacy_settings, basePrivacy),
        basePrivacy,
        isUnder18
      );
      const finalPrivacy = "privacySettings" in body && body.privacySettings ? sanitizePrivacySettings(body.privacySettings, currentPrivacy, isUnder18) : currentPrivacy;
      const finalDisplayName = nextDisplayName ?? current.display_name ?? extractFirstName(current.name || "Member");
      const finalTagline = nextTagline ?? current.tagline ?? "";
      const finalAvatar = "avatarUrl" in body ? nextAvatarUrl : current.avatar_url;
      const finalCover = "coverUrl" in body ? nextCoverUrl : current.cover_url;
      const finalBio = nextBio ?? current.bio ?? "";
      const finalState = nextLocationState ?? current.location_state ?? "";
      const finalCampus = nextCampus ?? current.campus ?? "";
      const finalArea = nextArea ?? current.location_area ?? "";
      const finalInterests = nextInterests ?? parseJsonSafe(current.interests, []);
      const finalLanguages = nextLanguages ?? parseJsonSafe(current.languages, []);
      await client.query(
        `UPDATE shopit_users
         SET display_name = $1, profile_slug = $2, tagline = $3, avatar_url = $4, cover_url = $5,
             bio = $6, location_state = $7, campus = $8, location_area = $9,
             interests = $10::jsonb, languages = $11::jsonb, privacy_settings = $12::jsonb, updated_at = NOW()
         WHERE id = $13`,
        [
          finalDisplayName,
          nextSlug,
          finalTagline,
          finalAvatar ?? null,
          finalCover ?? null,
          finalBio,
          finalState,
          finalCampus,
          finalArea,
          JSON.stringify(finalInterests),
          JSON.stringify(finalLanguages),
          JSON.stringify(finalPrivacy),
          userId
        ]
      );
      let sellerUpdated = null;
      if (sRow) {
        const finalShopName = nextShopName ?? sRow.shop_name;
        const finalShopBio = nextShopBio ?? (nextBio !== void 0 && !sRow.bio ? nextBio : sRow.bio) ?? "";
        const finalShopStory = nextShopStory ?? sRow.shop_story ?? "";
        const finalCraftMaterials = nextCraftMaterials ?? sRow.craft_materials ?? "";
        const finalProcessingTime = nextProcessingTime ?? sRow.processing_time ?? "";
        const currentDeliv = parseJsonSafe(sRow.delivery_options, { allowsPickup: true, allowsLocalDelivery: true, pickupSpots: [] });
        const finalDeliv = nextDeliveryOptions ?? {
          allowsPickup: currentDeliv?.allowsPickup !== false,
          allowsLocalDelivery: currentDeliv?.allowsLocalDelivery !== false,
          pickupSpots: Array.isArray(currentDeliv?.pickupSpots) ? currentDeliv.pickupSpots : []
        };
        const finalSellerState = nextLocationState || sRow.location_state || "Lagos";
        const finalSellerCampus = nextCampus || sRow.campus;
        const finalSellerArea = nextArea || sRow.location_area;
        const finalVacationMode = nextVacationMode !== void 0 ? nextVacationMode : Boolean(sRow.vacation_mode);
        const finalLogo = "logoUrl" in body ? nextLogoUrl : "avatarUrl" in body ? finalAvatar : sRow.logo_url;
        const finalBanner = "bannerUrl" in body ? nextBannerUrl : "coverUrl" in body ? finalCover : sRow.banner_url;
        await client.query(
          `UPDATE shopit_sellers
           SET shop_name = $1, bio = $2, shop_story = $3, craft_materials = $4, processing_time = $5,
               delivery_options = $6::jsonb, location_state = $7, campus = $8, location_area = $9,
               vacation_mode = $10, logo_url = $11, banner_url = $12, updated_at = NOW()
           WHERE id = $13`,
          [
            finalShopName,
            finalShopBio,
            finalShopStory,
            finalCraftMaterials,
            finalProcessingTime,
            JSON.stringify(finalDeliv),
            finalSellerState,
            finalSellerCampus,
            finalSellerArea,
            finalVacationMode,
            finalLogo ?? null,
            finalBanner ?? null,
            sRow.id
          ]
        );
        if (nextShopName || nextLocationState || nextCampus || nextArea) {
          await client.query(
            `UPDATE shopit_products
             SET seller_shop_name = COALESCE($1, seller_shop_name),
                 location_state = COALESCE($2, location_state),
                 seller_campus = COALESCE($3, seller_campus),
                 location_area = COALESCE($4, location_area),
                 updated_at = NOW()
             WHERE seller_id = $5 OR seller_id = $6`,
            [nextShopName || null, nextLocationState || null, nextCampus || null, nextArea || null, userId, sRow.id]
          );
        }
        sellerUpdated = {
          shopName: finalShopName,
          bio: finalShopBio,
          shopStory: finalShopStory,
          craftMaterials: finalCraftMaterials,
          processingTime: finalProcessingTime,
          deliveryOptions: finalDeliv,
          locationState: finalSellerState,
          campus: finalSellerCampus,
          locationArea: finalSellerArea,
          vacationMode: finalVacationMode
        };
      }
      return {
        displayName: finalDisplayName,
        profileSlug: nextSlug,
        canonicalSlug: nextSlug,
        ...previousSlug ? { previousSlug } : {},
        tagline: finalTagline,
        avatarUrl: finalAvatar || null,
        coverUrl: finalCover || null,
        bio: finalBio,
        locationState: finalState,
        campus: finalCampus,
        locationArea: finalArea,
        interests: finalInterests,
        languages: finalLanguages,
        privacySettings: finalPrivacy,
        ...sellerUpdated ? { seller: sellerUpdated } : {}
      };
    });
    if (!updated) {
      return res.status(404).json({ status: false, message: "User account not found." });
    }
    await logAuditEvent({
      action: "PROFILE_UPDATED",
      actor: { id: userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id: userId },
      details: { displayName: updated.displayName, profileSlug: updated.profileSlug },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, profile: updated, message: "Profile saved." });
  } catch (err) {
    console.error("[PATCH /profiles/me Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to save profile changes." });
  }
});
router2.patch("/profiles/me/settings", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["notificationPrefs", "privacySettings"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { notificationPrefs, privacySettings } = check.obj;
    const userId = req.user.userId;
    const uRes = await query(
      `SELECT u.age, u.notification_prefs, u.privacy_settings, s.under_18 as s_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.id = $1`,
      [userId]
    );
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "User not found." });
    }
    const row = uRes.rows[0];
    const isUnder18 = row.age !== null && row.age !== void 0 && Number(row.age) < 18 || Boolean(row.s_under_18);
    const currentNotif = sanitizeNotificationPrefs(parseJsonSafe(row.notification_prefs, DEFAULT_NOTIFICATION_PREFS));
    const nextNotif = notificationPrefs ? sanitizeNotificationPrefs(notificationPrefs, currentNotif) : currentNotif;
    const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const currentPrivacy = sanitizePrivacySettings(parseJsonSafe(row.privacy_settings, basePrivacy), basePrivacy, isUnder18);
    const nextPrivacy = privacySettings ? sanitizePrivacySettings(privacySettings, currentPrivacy, isUnder18) : currentPrivacy;
    await query(
      `UPDATE shopit_users
       SET notification_prefs = $1::jsonb, privacy_settings = $2::jsonb, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(nextNotif), JSON.stringify(nextPrivacy), userId]
    );
    await logAuditEvent({
      action: "ACCOUNT_SETTINGS_UPDATED",
      actor: { id: userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id: userId },
      details: { isUnder18, profileVisibility: nextPrivacy.profileVisibility },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      notificationPrefs: nextNotif,
      privacySettings: nextPrivacy,
      isUnder18,
      message: isUnder18 ? "Settings saved. Minor safety defaults for follow requests and messages remain active." : "Account settings saved."
    });
  } catch (err) {
    console.error("[PATCH /profiles/me/settings Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to update settings." });
  }
});
router2.get("/profiles/me/export", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [uRes, sRes, ordRes, wishRes, cartRes, notifRes, convRes, folRes, blkRes] = await Promise.all([
      query(
        `SELECT id, email, name, display_name, profile_slug, role, age, bio, campus, location_area, interests,
                notification_prefs, privacy_settings, is_verified_email, created_at, last_login_at
         FROM shopit_users WHERE id = $1`,
        [userId]
      ),
      query(
        `SELECT id, shop_name, owner_name, bio, campus, location_state, location_city, location_area,
                is_verified_seller, verification_status, under_18, vacation_mode, rating, sales_count, created_at
         FROM shopit_sellers WHERE user_id = $1 OR id = $1`,
        [userId]
      ),
      query(
        `SELECT id, items, subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
                status, delivery_area, pickup_point, created_at, delivered_at, completed_at
         FROM shopit_orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [userId]
      ),
      query("SELECT product_ids, updated_at FROM shopit_wishlists WHERE user_id = $1", [userId]),
      query("SELECT items, updated_at FROM shopit_carts WHERE user_id = $1", [userId]),
      query("SELECT id, title, message, type, is_read, created_at FROM shopit_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200", [userId]),
      query("SELECT id, product_title, seller_shop_name, last_message, last_message_at, created_at FROM shopit_chat_conversations WHERE buyer_id = $1 OR seller_id = $1 ORDER BY created_at DESC LIMIT 100", [userId]),
      query("SELECT follower_id, following_id, status, created_at FROM shopit_follows WHERE follower_id = $1 OR following_id = $1", [userId]),
      query("SELECT blocked_id, reason, created_at FROM shopit_blocks WHERE blocker_id = $1", [userId])
    ]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Account not found." });
    }
    await logAuditEvent({
      action: "USER_DATA_EXPORTED",
      actor: { id: userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id: userId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    const payload = {
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      platform: "Shop It Nigeria (https://shopitng.vercel.app)",
      account: uRes.rows[0],
      sellerProfile: sRes.rows[0] || null,
      orders: ordRes.rows,
      wishlist: wishRes.rows[0] || { product_ids: [] },
      cart: cartRes.rows[0] || { items: [] },
      notifications: notifRes.rows,
      conversations: convRes.rows,
      follows: folRes.rows,
      blockedAccounts: blkRes.rows
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="shopit-my-data-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error("[GET /profiles/me/export Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to prepare your data export." });
  }
});
router2.delete("/profiles/me", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["password", "confirmation"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { password, confirmation } = check.obj;
    if (confirmation !== "DELETE") {
      return res.status(400).json({ status: false, message: "Please type DELETE to confirm account deletion." });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ status: false, message: "Your current password is required to delete your account." });
    }
    const userId = req.user.userId;
    const uRes = await query("SELECT id, email, role, password_hash FROM shopit_users WHERE id = $1", [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Account not found." });
    }
    const userRow = uRes.rows[0];
    if (!verifyPassword(password.trim(), userRow.password_hash)) {
      return res.status(401).json({ status: false, message: "Incorrect password." });
    }
    await revokeUserSessions(userId);
    const anonEmail = `deleted_${userId}@deleted.shopit.local`;
    const anonSlug = `deleted-${userId}`;
    await withTransaction(async (client) => {
      const sellerRows = await client.query("SELECT id FROM shopit_sellers WHERE user_id = $1 OR id = $1", [userId]);
      const sellerTargetIds = Array.from(/* @__PURE__ */ new Set([userId, ...sellerRows.rows.map((r) => r.id)]));
      const sellerIn = buildInClause2(sellerTargetIds);
      await client.query("DELETE FROM shopit_follows WHERE follower_id = $1 OR following_id = $1", [userId]);
      await client.query("DELETE FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1", [userId]);
      await client.query("DELETE FROM shopit_mutes WHERE muter_id = $1 OR muted_id = $1", [userId]);
      await client.query("DELETE FROM shopit_wishlists WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM shopit_carts WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM shopit_notifications WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM shopit_restock_alerts WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM shopit_files WHERE owner_id = $1", [userId]);
      await client.query("DELETE FROM shopit_verifications WHERE user_id = $1 OR seller_id = $1", [userId]);
      await client.query(`DELETE FROM shopit_verification_documents WHERE seller_id IN (${sellerIn.placeholders})`, sellerIn.params);
      await client.query(
        `UPDATE shopit_products
         SET is_paused = true, is_draft = true, is_pinned = false, updated_at = NOW()
         WHERE seller_id IN (${sellerIn.placeholders})`,
        sellerIn.params
      );
      await client.query(
        `UPDATE shopit_sellers
         SET shop_name = 'Deleted Shop', owner_name = 'Deleted User', email = $1,
             bio = '', logo_url = NULL, banner_url = NULL, guardian_name = NULL, guardian_phone = NULL,
             vacation_mode = true, updated_at = NOW()
         WHERE user_id = $2 OR id = $2`,
        [anonEmail, userId]
      );
      await client.query(
        `UPDATE shopit_orders
         SET buyer_name = 'Deleted User', buyer_email = NULL, buyer_masked_id = 'Deleted User', updated_at = NOW()
         WHERE buyer_id = $1`,
        [userId]
      );
      await client.query(
        `UPDATE shopit_disputes
         SET buyer_name = 'Deleted User', buyer_masked_id = 'Deleted User', updated_at = NOW()
         WHERE buyer_id = $1`,
        [userId]
      );
      await client.query(
        `UPDATE shopit_users
         SET email = $1, name = 'Deleted User', display_name = 'Deleted User', profile_slug = $2,
             avatar_url = NULL, cover_url = NULL, bio = NULL, campus = NULL, location_area = NULL,
             interests = '[]'::jsonb, guardian_name = NULL, is_banned = true, ban_reason = 'Account deleted by user',
             deleted_at = NOW(), token_version = COALESCE(token_version, 1) + 1, updated_at = NOW()
         WHERE id = $3`,
        [anonEmail, anonSlug, userId]
      );
      await client.query("DELETE FROM shopit_profile_slug_history WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM shopit_sessions WHERE user_id = $1", [userId]);
    });
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    await logAuditEvent({
      action: "ACCOUNT_DELETED_BY_USER",
      actor: { id: userId, email: userRow.email, role: userRow.role },
      target: { type: "user", id: userId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Your account has been permanently deleted and personal info anonymized." });
  } catch (err) {
    console.error("[DELETE /profiles/me Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to delete your account." });
  }
});
async function resolveTargetUserRecord(rawTarget) {
  const clean = String(rawTarget || "").trim();
  if (!clean) return null;
  const res = await query(
    `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.age, u.privacy_settings,
            u.notification_prefs, u.is_banned, u.deleted_at, s.id as s_id, s.under_18 as s_under_18
     FROM shopit_users u
     LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
     WHERE u.id = $1 OR s.id = $1 OR LOWER(u.profile_slug) = LOWER($1)
     LIMIT 1`,
    [clean]
  );
  if (res.rows[0]) return res.rows[0];
  const histRes = await query(
    "SELECT user_id FROM shopit_profile_slug_history WHERE LOWER(slug) = LOWER($1) LIMIT 1",
    [clean]
  );
  if (histRes.rows.length > 0 && histRes.rows[0].user_id) {
    const byIdRes = await query(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.age, u.privacy_settings,
              u.notification_prefs, u.is_banned, u.deleted_at, s.id as s_id, s.under_18 as s_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.id = $1
       LIMIT 1`,
      [histRes.rows[0].user_id]
    );
    return byIdRes.rows[0] || null;
  }
  return null;
}
__name(resolveTargetUserRecord, "resolveTargetUserRecord");
async function getAcceptedFollowersCount(targetUserId) {
  const res = await query(
    `SELECT COUNT(*) as total FROM shopit_follows WHERE following_id = $1 AND status = 'accepted'`,
    [targetUserId]
  );
  return parseInt(String(res.rows[0]?.total || "0"), 10);
}
__name(getAcceptedFollowersCount, "getAcceptedFollowersCount");
router2.post("/follows", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["targetUserId"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const rawTarget = String(check.obj.targetUserId || "").trim();
    if (!rawTarget) {
      return res.status(400).json({ status: false, message: "targetUserId is required." });
    }
    const viewer = req.user;
    const rl = await checkAndRecordRateLimit(`follows:${viewer.userId}`, 60, 60 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({
        status: false,
        message: "Too many follow requests right now. Please wait before following more accounts."
      });
    }
    const target = await resolveTargetUserRecord(rawTarget);
    if (!target || target.deleted_at || target.is_banned) {
      return res.status(404).json({ status: false, message: "Account not found or unavailable." });
    }
    if (target.id === viewer.userId) {
      return res.status(400).json({ status: false, message: "You cannot follow your own account." });
    }
    const blkRes = await query(
      `SELECT id FROM shopit_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [viewer.userId, target.id]
    );
    if (blkRes.rows.length > 0) {
      return res.status(403).json({ status: false, message: "Cannot follow this user due to a block." });
    }
    const viewerRes = await query(
      `SELECT u.age, u.display_name, u.name, u.profile_slug, s.under_18 AS s_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (s.user_id = u.id OR s.id = u.id)
       WHERE u.id = $1 LIMIT 1`,
      [viewer.userId]
    );
    const vRow = viewerRes.rows[0];
    const isTargetUnder18 = isMinorAccount({ age: target.age, sellerUnder18: target.s_under_18 });
    const viewerAge = vRow?.age !== null && vRow?.age !== void 0 ? Number(vRow.age) : null;
    const isViewerUnder18 = isMinorAccount({ age: viewerAge, sellerUnder18: vRow?.s_under_18 });
    const followDecision = evaluateMinorFollowRule({
      viewerAge,
      viewerIsUnder18: isViewerUnder18,
      targetIsUnder18: isTargetUnder18
    });
    if (!followDecision.allowed) {
      return res.status(403).json({
        status: false,
        message: followDecision.reason || "For youth safety, adults cannot follow or send follow requests to under-18 accounts."
      });
    }
    const existing = await query(
      "SELECT id, status FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1",
      [viewer.userId, target.id]
    );
    if (existing.rows.length > 0) {
      const existingStatus = existing.rows[0].status === "accepted" ? "accepted" : "pending";
      const followersCount2 = await getAcceptedFollowersCount(target.id);
      return res.json({ status: true, followStatus: existingStatus, followersCount: followersCount2 });
    }
    const basePrivacy = isTargetUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const privacy = sanitizePrivacySettings(parseJsonSafe(target.privacy_settings, basePrivacy), basePrivacy, isTargetUnder18);
    const followStatus = followDecision.forcedStatus || (privacy.whoCanFollow === "approval" ? "pending" : "accepted");
    const followId = `fol_${Date.now()}_${crypto9.randomBytes(4).toString("hex")}`;
    const insRes = await query(
      `INSERT INTO shopit_follows (id, follower_id, following_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (follower_id, following_id) DO NOTHING
       RETURNING id`,
      [followId, viewer.userId, target.id, followStatus]
    );
    if (insRes.rows.length === 0) {
      const raceRes = await query(
        "SELECT status FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1",
        [viewer.userId, target.id]
      );
      const settledStatus = raceRes.rows[0]?.status === "accepted" ? "accepted" : "pending";
      const followersCount2 = await getAcceptedFollowersCount(target.id);
      return res.json({ status: true, followStatus: settledStatus, followersCount: followersCount2 });
    }
    try {
      const muteRes = await query(
        "SELECT 1 FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2 LIMIT 1",
        [target.id, viewer.userId]
      );
      const isMuted = muteRes.rows.length > 0;
      if (!isMuted) {
        const vName = vRow?.display_name || extractFirstName(vRow?.name || viewer.name || "Someone");
        const vSlug = vRow?.profile_slug || viewer.userId;
        const reverseRes = await query(
          `SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`,
          [target.id, viewer.userId]
        );
        const isMutualFollowBack = followStatus === "accepted" && reverseRes.rows.length > 0;
        const notifTitle = followStatus === "pending" ? "New Follow Request" : isMutualFollowBack ? "Follow Back \u2014 Friends!" : "New Follower";
        const notifMsg = followStatus === "pending" ? `${vName} requested to follow your Shop It profile.` : isMutualFollowBack ? `${vName} followed you back \u2014 you're now friends on Shop It!` : `${vName} started following you on Shop It.`;
        await query(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, $3, $4, 'info', false, $5, NOW())`,
          [
            `notif_fol_${Date.now()}_${crypto9.randomBytes(3).toString("hex")}`,
            target.id,
            notifTitle,
            notifMsg,
            `/?profile=${encodeURIComponent(vSlug)}`
          ]
        );
        const targetEmailRes = await query(
          "SELECT email, display_name, name, notification_prefs FROM shopit_users WHERE id = $1 LIMIT 1",
          [target.id]
        );
        const tEmailRow = targetEmailRes.rows[0];
        const tPrefs = sanitizeNotificationPrefs(
          parseJsonSafe(tEmailRow?.notification_prefs, DEFAULT_NOTIFICATION_PREFS)
        );
        if (tPrefs.emailFollowers && tEmailRow?.email && !String(tEmailRow.email).endsWith(".local")) {
          const tName = tEmailRow.display_name || extractFirstName(tEmailRow.name || "Friend");
          sendBrevoDirect(
            tEmailRow.email,
            `Shop It: ${notifTitle}`,
            `Hi ${tName},

${notifMsg}

Visit Shop It to view their profile.`,
            `<p>Hi ${tName},</p><p>${notifMsg}</p>`,
            tName
          ).catch(() => {
          });
        }
      }
    } catch {
    }
    const followersCount = await getAcceptedFollowersCount(target.id);
    return res.status(201).json({ status: true, followStatus, followersCount });
  } catch (err) {
    console.error("[POST /follows Error]:", err?.message || err);
    return res.status(500).json({ status: false, message: "Failed to follow user." });
  }
});
router2.delete("/follows/:targetUserId", requireAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const rawTarget = String(req.params.targetUserId || "").trim();
    const target = await resolveTargetUserRecord(rawTarget);
    const resolvedTargetId = target?.id || rawTarget;
    await query(
      "DELETE FROM shopit_follows WHERE follower_id = $1 AND following_id = $2",
      [viewer.userId, resolvedTargetId]
    );
    const followersCount = await getAcceptedFollowersCount(resolvedTargetId);
    return res.json({ status: true, followStatus: "none", followersCount });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to unfollow user." });
  }
});
router2.get("/follows/requests", requireAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const resRows = await query(
      `SELECT f.id, f.follower_id, f.created_at, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus
       FROM shopit_follows f
       JOIN shopit_users u ON u.id = f.follower_id
       WHERE f.following_id = $1 AND f.status = 'pending' AND u.deleted_at IS NULL AND u.is_banned IS NOT TRUE
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [viewer.userId]
    );
    return res.json({
      status: true,
      requests: resRows.rows.map((r) => ({
        id: r.id,
        followerId: r.follower_id,
        displayName: r.display_name || extractFirstName(r.name || "Member"),
        profileSlug: r.profile_slug || r.follower_id,
        avatarUrl: r.avatar_url || null,
        campus: r.campus || "",
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to load follow requests." });
  }
});
router2.patch("/follows/requests/:followerId", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["action"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const action = String(check.obj.action || "").trim();
    if (action !== "accept" && action !== "decline") {
      return res.status(400).json({ status: false, message: "action must be accept or decline." });
    }
    const viewer = req.user;
    const followerId = String(req.params.followerId || "").trim();
    const existing = await query(
      `SELECT id FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'pending' LIMIT 1`,
      [followerId, viewer.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Pending follow request not found." });
    }
    if (action === "accept") {
      await query(
        `UPDATE shopit_follows SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id]
      );
      try {
        const myRes = await query("SELECT display_name, name, profile_slug FROM shopit_users WHERE id = $1", [viewer.userId]);
        const myRow = myRes.rows[0];
        const myName = myRow?.display_name || extractFirstName(myRow?.name || viewer.name || "Someone");
        const mySlug = myRow?.profile_slug || viewer.userId;
        await query(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, 'Follow Request Accepted', $3, 'success', false, $4, NOW())`,
          [
            `notif_fol_acc_${Date.now()}_${crypto9.randomBytes(3).toString("hex")}`,
            followerId,
            `${myName} accepted your follow request.`,
            `/?profile=${encodeURIComponent(mySlug)}`
          ]
        );
      } catch {
      }
    } else {
      await query("DELETE FROM shopit_follows WHERE id = $1", [existing.rows[0].id]);
    }
    const followersCount = await getAcceptedFollowersCount(viewer.userId);
    return res.json({ status: true, action, followersCount });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to process follow request." });
  }
});
router2.get("/feed/following", requireAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(String(req.query.limit || "30"), 10) || 30));
    const offset = (page - 1) * limit;
    const [folRes, blkRes] = await Promise.all([
      query(`SELECT following_id FROM shopit_follows WHERE follower_id = $1 AND status = 'accepted'`, [viewer.userId]),
      query(
        `SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1`,
        [viewer.userId]
      )
    ]);
    const blockedSet = /* @__PURE__ */ new Set();
    for (const b of blkRes.rows) {
      if (b.blocker_id !== viewer.userId) blockedSet.add(b.blocker_id);
      if (b.blocked_id !== viewer.userId) blockedSet.add(b.blocked_id);
    }
    const followedUserIds = Array.from(
      new Set(folRes.rows.map((r) => String(r.following_id)).filter((id) => id && !blockedSet.has(id)))
    );
    if (followedUserIds.length === 0) {
      return res.json({ status: true, products: [], total: 0, followingCount: 0, page, totalPages: 1 });
    }
    const uIn = buildInClause2(followedUserIds);
    const sRes = await query(
      `SELECT id, user_id FROM shopit_sellers WHERE user_id IN (${uIn.placeholders}) OR id IN (${uIn.placeholders})`,
      uIn.params
    );
    const sellerTargetIds = Array.from(
      /* @__PURE__ */ new Set([...followedUserIds, ...sRes.rows.map((s) => String(s.id))])
    );
    const pIn = buildInClause2(sellerTargetIds);
    const countRes = await query(
      `SELECT COUNT(*) as total
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.seller_id IN (${pIn.placeholders})
         AND (p.is_paused IS NOT TRUE)
         AND (p.is_draft IS NOT TRUE)
         AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE))`,
      pIn.params
    );
    const total = parseInt(String(countRes.rows[0]?.total || "0"), 10);
    const rowsRes = await query(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.seller_id IN (${pIn.placeholders})
         AND (p.is_paused IS NOT TRUE)
         AND (p.is_draft IS NOT TRUE)
         AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE))
       ORDER BY p.created_at DESC
       LIMIT $${pIn.params.length + 1} OFFSET $${pIn.params.length + 2}`,
      [...pIn.params, limit, offset]
    );
    const products = rowsRes.rows.map(
      (r) => mapProductRow(
        r,
        r.u_display_name || extractFirstName(r.u_name || r.seller_shop_name || "Artisan"),
        r.s_logo_url || r.u_avatar_url || void 0,
        r.u_profile_slug || void 0
      )
    );
    return res.json({
      status: true,
      products,
      total,
      followingCount: followedUserIds.length,
      page,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("[GET /feed/following Error]:", err?.message || err);
    return res.status(500).json({ status: false, message: "Failed to load Following feed." });
  }
});
router2.get("/blocks", requireAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const rows = await query(
      `SELECT b.id, b.blocked_id, b.reason, b.created_at, u.name, u.display_name, u.profile_slug, u.avatar_url
       FROM shopit_blocks b
       LEFT JOIN shopit_users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC
       LIMIT 100`,
      [viewer.userId]
    );
    return res.json({
      status: true,
      blocks: rows.rows.map((r) => ({
        id: r.id,
        blockedUserId: r.blocked_id,
        displayName: r.display_name || extractFirstName(r.name || "Member"),
        profileSlug: r.profile_slug || r.blocked_id,
        avatarUrl: r.avatar_url || null,
        reason: r.reason || "",
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to fetch blocked accounts." });
  }
});
router2.post("/blocks", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["targetUserId", "reason"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const rawTarget = String(check.obj.targetUserId || "").trim();
    const reason = check.obj.reason ? String(check.obj.reason).trim().slice(0, 200) : null;
    if (!rawTarget) {
      return res.status(400).json({ status: false, message: "targetUserId is required." });
    }
    const viewer = req.user;
    const target = await resolveTargetUserRecord(rawTarget);
    if (!target || target.deleted_at) {
      return res.status(404).json({ status: false, message: "User account not found." });
    }
    if (target.id === viewer.userId) {
      return res.status(400).json({ status: false, message: "You cannot block yourself." });
    }
    await withTransaction(async (client) => {
      const blkId = `blk_${Date.now()}_${crypto9.randomBytes(4).toString("hex")}`;
      await client.query(
        `INSERT INTO shopit_blocks (id, blocker_id, blocked_id, reason, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = COALESCE($4, shopit_blocks.reason)`,
        [blkId, viewer.userId, target.id, reason]
      );
      await client.query(
        `DELETE FROM shopit_follows
         WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`,
        [viewer.userId, target.id]
      );
    });
    await logAuditEvent({
      action: "USER_BLOCKED",
      actor: { id: viewer.userId, email: viewer.email, role: viewer.role },
      target: { type: "user", id: target.id },
      details: { reason },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({
      status: true,
      blockedUserId: target.id,
      message: `${target.display_name || extractFirstName(target.name || "User")} has been blocked.`
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to block user." });
  }
});
router2.delete("/blocks/:targetUserId", requireAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const rawTarget = String(req.params.targetUserId || "").trim();
    const target = await resolveTargetUserRecord(rawTarget);
    const resolvedId = target?.id || rawTarget;
    await query("DELETE FROM shopit_blocks WHERE blocker_id = $1 AND blocked_id = $2", [
      viewer.userId,
      resolvedId
    ]);
    await logAuditEvent({
      action: "USER_UNBLOCKED",
      actor: { id: viewer.userId, email: viewer.email, role: viewer.role },
      target: { type: "user", id: resolvedId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "User unblocked." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to unblock user." });
  }
});
async function handleFollowListRoute(req, res, mode) {
  try {
    const rawSlug = String(req.params.slug || "").trim();
    const target = await resolveTargetUserRecord(rawSlug);
    if (!target || target.deleted_at) {
      return res.status(404).json({ status: false, message: "Profile not found." });
    }
    const viewer = req.user;
    const isOwner = Boolean(viewer && viewer.userId === target.id);
    const isAdmin = Boolean(viewer && viewer.role === "admin");
    if (target.is_banned && !isAdmin) {
      return res.status(404).json({ status: false, message: "Profile not found." });
    }
    if (viewer && !isOwner && !isAdmin) {
      const blkRes = await query(
        `SELECT id FROM shopit_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
        [viewer.userId, target.id]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, message: "This profile is unavailable." });
      }
    }
    const isUnder18 = target.age !== null && target.age !== void 0 && Number(target.age) < 18 || Boolean(target.s_under_18);
    const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const privacy = sanitizePrivacySettings(parseJsonSafe(target.privacy_settings, basePrivacy), basePrivacy, isUnder18);
    if (privacy.profileVisibility === "followers" && !isOwner && !isAdmin) {
      let acceptedFollow = false;
      if (viewer) {
        const fCheck = await query(
          `SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`,
          [viewer.userId, target.id]
        );
        acceptedFollow = fCheck.rows.length > 0;
      }
      if (!acceptedFollow) {
        return res.status(403).json({ status: false, message: "Only accepted followers can view this profile." });
      }
    }
    if (mode === "followers" && !privacy.showFollowersList && !isOwner && !isAdmin) {
      return res.status(403).json({ status: false, message: "This member has hidden their followers list." });
    }
    if (mode === "following" && !privacy.showFollowingList && !isOwner && !isAdmin) {
      return res.status(403).json({ status: false, message: "This member has hidden who they follow." });
    }
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);
    const searchQ = String(req.query.q || "").trim().toLowerCase();
    const joinCol = mode === "followers" ? "f.follower_id" : "f.following_id";
    const filterCol = mode === "followers" ? "f.following_id" : "f.follower_id";
    const params = [target.id];
    let searchClause = "";
    if (searchQ) {
      params.push(`%${searchQ}%`);
      const pIdx = params.length;
      searchClause = ` AND (
        LOWER(COALESCE(u.display_name, '')) LIKE $${pIdx}
        OR LOWER(COALESCE(u.name, '')) LIKE $${pIdx}
        OR LOWER(COALESCE(u.profile_slug, '')) LIKE $${pIdx}
        OR LOWER(COALESCE(s.shop_name, '')) LIKE $${pIdx}
      )`;
    }
    const countRes = await query(
      `SELECT COUNT(*) as total
       FROM shopit_follows f
       JOIN shopit_users u ON u.id = ${joinCol}
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE ${filterCol} = $1 AND f.status = 'accepted' AND u.deleted_at IS NULL AND u.is_banned IS NOT TRUE${searchClause}`,
      params
    );
    const total = parseInt(String(countRes.rows[0]?.total || "0"), 10);
    const rowsRes = await query(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus, u.role, s.shop_name, f.created_at
       FROM shopit_follows f
       JOIN shopit_users u ON u.id = ${joinCol}
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE ${filterCol} = $1 AND f.status = 'accepted' AND u.deleted_at IS NULL AND u.is_banned IS NOT TRUE${searchClause}
       ORDER BY f.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const listedIds = rowsRes.rows.map((r) => String(r.id)).filter(Boolean);
    const viewerFollowingMap = /* @__PURE__ */ new Map();
    const viewerFollowedBySet = /* @__PURE__ */ new Set();
    if (viewer && listedIds.length > 0) {
      const lIn = buildInClause2(listedIds, 2);
      const [vfRes, vfbRes] = await Promise.all([
        query(
          `SELECT following_id, status FROM shopit_follows WHERE follower_id = $1 AND following_id IN (${lIn.placeholders})`,
          [viewer.userId, ...lIn.params]
        ),
        query(
          `SELECT follower_id FROM shopit_follows WHERE following_id = $1 AND follower_id IN (${lIn.placeholders}) AND status = 'accepted'`,
          [viewer.userId, ...lIn.params]
        )
      ]);
      for (const r of vfRes.rows) {
        viewerFollowingMap.set(String(r.following_id), r.status === "accepted" ? "accepted" : "pending");
      }
      for (const r of vfbRes.rows) {
        viewerFollowedBySet.add(String(r.follower_id));
      }
    }
    return res.json({
      status: true,
      total,
      users: rowsRes.rows.map((r) => {
        const vfStatus = viewer ? viewerFollowingMap.get(String(r.id)) || "none" : void 0;
        const isMutual = viewer ? vfStatus === "accepted" && viewerFollowedBySet.has(String(r.id)) : false;
        return {
          id: r.id,
          displayName: r.display_name || extractFirstName(r.name || "Member"),
          profileSlug: r.profile_slug || r.id,
          avatarUrl: r.avatar_url || null,
          campus: r.campus || "",
          role: r.role,
          shopName: r.shop_name || void 0,
          followedAt: r.created_at,
          viewerFollowStatus: vfStatus,
          isMutual
        };
      })
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: `Failed to fetch ${mode} list.` });
  }
}
__name(handleFollowListRoute, "handleFollowListRoute");
router2.get(
  "/profiles/:slug/followers",
  optionalAuth,
  (req, res) => handleFollowListRoute(req, res, "followers")
);
router2.get(
  "/profiles/:slug/following",
  optionalAuth,
  (req, res) => handleFollowListRoute(req, res, "following")
);
router2.get("/profiles/discover/suggested", optionalAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || "8"), 10) || 8));
    let viewerCampus = "";
    const excludeUserIds = /* @__PURE__ */ new Set();
    if (viewer) {
      excludeUserIds.add(viewer.userId);
      const [vRes, folRes, blkRes] = await Promise.all([
        query("SELECT campus FROM shopit_users WHERE id = $1 LIMIT 1", [viewer.userId]),
        query("SELECT following_id FROM shopit_follows WHERE follower_id = $1", [viewer.userId]),
        query("SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1", [viewer.userId])
      ]);
      viewerCampus = String(vRes.rows[0]?.campus || "").trim().toLowerCase();
      for (const f of folRes.rows) excludeUserIds.add(String(f.following_id));
      for (const b of blkRes.rows) {
        if (b.blocker_id !== viewer.userId) excludeUserIds.add(String(b.blocker_id));
        if (b.blocked_id !== viewer.userId) excludeUserIds.add(String(b.blocked_id));
      }
    }
    const rowsRes = await query(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus, u.age,
              s.id as s_id, s.shop_name, s.campus as s_campus, s.bio as s_bio, u.bio as u_bio,
              s.logo_url as s_logo_url, s.is_verified_seller, s.verification_status,
              s.under_18 as s_under_18, s.rating as s_rating
       FROM shopit_users u
       JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.deleted_at IS NULL
         AND u.is_banned IS NOT TRUE
         AND COALESCE(s.vacation_mode, false) = false
         AND COALESCE(s.under_18, false) = false
         AND (u.age IS NULL OR u.age >= 18)
       ORDER BY COALESCE(s.is_verified_seller, false) DESC, COALESCE(s.rating, 5.0) DESC, u.created_at DESC
       LIMIT 60`
    );
    const seen = /* @__PURE__ */ new Set();
    const baseCandidates = rowsRes.rows.filter((r) => {
      if (MINOR_SAFETY_RULES.hideMinorsFromSearchAndDiscovery && isMinorAccount({ age: r.age, sellerUnder18: r.s_under_18 })) {
        return false;
      }
      if (excludeUserIds.has(r.id) || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    const followerCountMap = /* @__PURE__ */ new Map();
    const productCountMap = /* @__PURE__ */ new Map();
    if (baseCandidates.length > 0) {
      const userIds = baseCandidates.map((r) => String(r.id));
      const sellerRefs = baseCandidates.flatMap((r) => [String(r.id), String(r.s_id || "")]).filter(Boolean);
      const folIn = buildInClause2(userIds, 1);
      const prodIn = buildInClause2(sellerRefs, 1);
      const [folCountsRes, prodCountsRes] = await Promise.all([
        query(
          `SELECT following_id, COUNT(*) as cnt
           FROM shopit_follows
           WHERE status = 'accepted' AND following_id IN (${folIn.placeholders})
           GROUP BY following_id`,
          folIn.params
        ),
        query(
          `SELECT seller_id, COUNT(*) as cnt
           FROM shopit_products
           WHERE is_paused IS NOT TRUE AND is_draft IS NOT TRUE AND seller_id IN (${prodIn.placeholders})
           GROUP BY seller_id`,
          prodIn.params
        )
      ]);
      for (const fr of folCountsRes.rows) {
        followerCountMap.set(String(fr.following_id), parseInt(String(fr.cnt || "0"), 10) || 0);
      }
      for (const pr of prodCountsRes.rows) {
        productCountMap.set(
          String(pr.seller_id),
          (productCountMap.get(String(pr.seller_id)) || 0) + (parseInt(String(pr.cnt || "0"), 10) || 0)
        );
      }
    }
    const candidates = baseCandidates.map((r) => {
      const campus = r.campus || r.s_campus || "";
      const isSameCampus = Boolean(viewerCampus && campus.trim().toLowerCase() === viewerCampus);
      const isVerified = Boolean(
        r.is_verified_seller || r.verification_status === "verified" || r.verification_status === "approved"
      );
      const prodCountBySeller = r.s_id && r.s_id !== r.id ? productCountMap.get(String(r.s_id)) || 0 : 0;
      const productCount = (productCountMap.get(String(r.id)) || 0) + prodCountBySeller;
      const followersCount = followerCountMap.get(String(r.id)) || 0;
      const rating = parseFloat(String(r.s_rating || "5.0"));
      const score = (isSameCampus ? 50 : 0) + (isVerified ? 25 : 0) + Math.min(20, productCount * 4) + rating * 2;
      return {
        id: r.id,
        displayName: r.display_name || extractFirstName(r.name || "Seller"),
        profileSlug: r.profile_slug || r.id,
        shopName: r.shop_name || "Artisan Shop",
        avatarUrl: r.avatar_url || r.s_logo_url || null,
        campus,
        bio: String(r.u_bio || r.s_bio || "").slice(0, 120),
        isVerifiedSeller: isVerified,
        productCount,
        followersCount,
        rating,
        isSameCampus,
        _score: score
      };
    }).sort((a, b) => b._score - a._score).slice(0, limit).map(({ _score, ...rest }) => rest);
    return res.json({ status: true, sellers: candidates });
  } catch (err) {
    console.error("[GET /profiles/discover/suggested Error]:", err?.message || err);
    return res.status(500).json({ status: false, message: "Failed to load suggested sellers." });
  }
});
router2.get("/profiles/search", optionalAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit || "12"), 10) || 12));
    if (q.length < 2) {
      return res.json({ status: true, profiles: [] });
    }
    const viewer = req.user;
    const blockedSet = /* @__PURE__ */ new Set();
    const followMap = /* @__PURE__ */ new Map();
    if (viewer) {
      const [blkRes, folRes] = await Promise.all([
        query("SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1", [viewer.userId]),
        query("SELECT following_id, status FROM shopit_follows WHERE follower_id = $1", [viewer.userId])
      ]);
      for (const b of blkRes.rows) {
        if (b.blocker_id !== viewer.userId) blockedSet.add(String(b.blocker_id));
        if (b.blocked_id !== viewer.userId) blockedSet.add(String(b.blocked_id));
      }
      for (const f of folRes.rows) {
        followMap.set(String(f.following_id), f.status === "accepted" ? "accepted" : "pending");
      }
    }
    const pattern = `%${q.toLowerCase()}%`;
    const rowsRes = await query(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus, u.role, u.age,
              s.id as s_id, s.shop_name, s.logo_url as s_logo_url, s.campus as s_campus,
              s.is_verified_seller, s.verification_status, s.under_18 as s_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.deleted_at IS NULL
         AND u.is_banned IS NOT TRUE
         AND COALESCE(s.under_18, false) = false
         AND (u.age IS NULL OR u.age >= 18)
         AND (
           LOWER(COALESCE(u.display_name, '')) LIKE $1
           OR LOWER(COALESCE(u.name, '')) LIKE $1
           OR LOWER(COALESCE(u.profile_slug, '')) LIKE $1
           OR LOWER(COALESCE(u.campus, '')) LIKE $1
           OR LOWER(COALESCE(s.shop_name, '')) LIKE $1
         )
       ORDER BY COALESCE(s.is_verified_seller, false) DESC, u.created_at DESC
       LIMIT 50`,
      [pattern]
    );
    const seen = /* @__PURE__ */ new Set();
    const filteredRows = rowsRes.rows.filter((r) => {
      if (MINOR_SAFETY_RULES.hideMinorsFromSearchAndDiscovery && isMinorAccount({ age: r.age, sellerUnder18: r.s_under_18 })) {
        return false;
      }
      if (blockedSet.has(r.id) || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).slice(0, limit);
    const searchFollowerCountMap = /* @__PURE__ */ new Map();
    if (filteredRows.length > 0) {
      const fIn = buildInClause2(filteredRows.map((r) => String(r.id)), 1);
      const fcRes = await query(
        `SELECT following_id, COUNT(*) as cnt
         FROM shopit_follows
         WHERE status = 'accepted' AND following_id IN (${fIn.placeholders})
         GROUP BY following_id`,
        fIn.params
      );
      for (const fr of fcRes.rows) {
        searchFollowerCountMap.set(String(fr.following_id), parseInt(String(fr.cnt || "0"), 10) || 0);
      }
    }
    const profiles = filteredRows.map((r) => ({
      id: r.id,
      displayName: r.display_name || extractFirstName(r.name || "Member"),
      profileSlug: r.profile_slug || r.id,
      role: r.role,
      shopName: r.shop_name || void 0,
      avatarUrl: r.avatar_url || r.s_logo_url || null,
      campus: r.campus || r.s_campus || "",
      isVerifiedSeller: Boolean(
        r.is_verified_seller || r.verification_status === "verified" || r.verification_status === "approved"
      ),
      followersCount: searchFollowerCountMap.get(String(r.id)) || 0,
      followStatus: viewer ? followMap.get(r.id) || "none" : "none"
    }));
    return res.json({ status: true, profiles });
  } catch (err) {
    console.error("[GET /profiles/search Error]:", err?.message || err);
    return res.status(500).json({ status: false, message: "Failed to search profiles." });
  }
});
router2.get("/mutes", requireAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const rows = await query(
      `SELECT m.id, m.muted_id, m.created_at, u.name, u.display_name, u.profile_slug, u.avatar_url
       FROM shopit_mutes m
       JOIN shopit_users u ON u.id = m.muted_id
       WHERE m.muter_id = $1 AND u.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 100`,
      [viewer.userId]
    );
    return res.json({
      status: true,
      mutes: rows.rows.map((r) => ({
        id: r.id,
        mutedUserId: r.muted_id,
        displayName: r.display_name || extractFirstName(r.name || "Member"),
        profileSlug: r.profile_slug || r.muted_id,
        avatarUrl: r.avatar_url || null,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to load muted accounts." });
  }
});
router2.post("/mutes", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["targetUserId"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const rawTarget = String(check.obj.targetUserId || "").trim();
    if (!rawTarget) {
      return res.status(400).json({ status: false, message: "targetUserId is required." });
    }
    const viewer = req.user;
    const target = await resolveTargetUserRecord(rawTarget);
    if (!target || target.deleted_at) {
      return res.status(404).json({ status: false, message: "User account not found." });
    }
    if (target.id === viewer.userId) {
      return res.status(400).json({ status: false, message: "You cannot mute yourself." });
    }
    const muteId = `mute_${Date.now()}_${crypto9.randomBytes(4).toString("hex")}`;
    await query(
      `INSERT INTO shopit_mutes (id, muter_id, muted_id, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (muter_id, muted_id) DO NOTHING`,
      [muteId, viewer.userId, target.id]
    );
    return res.status(201).json({
      status: true,
      mutedUserId: target.id,
      message: `Muted notifications from ${target.display_name || extractFirstName(target.name || "User")}.`
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to mute user." });
  }
});
router2.delete("/mutes/:targetUserId", requireAuth, async (req, res) => {
  try {
    const viewer = req.user;
    const rawTarget = String(req.params.targetUserId || "").trim();
    const target = await resolveTargetUserRecord(rawTarget);
    const resolvedId = target?.id || rawTarget;
    await query("DELETE FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2", [
      viewer.userId,
      resolvedId
    ]);
    return res.json({ status: true, message: "User unmuted." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to unmute user." });
  }
});
router2.get("/profiles/:slug", optionalAuth, async (req, res) => {
  try {
    const rawSlug = String(req.params.slug || "").trim();
    if (!rawSlug || rawSlug.length > 120) {
      return res.status(400).json({ status: false, message: "Invalid profile identifier." });
    }
    const viewer = req.user;
    let uRes = await query(
      `SELECT u.*, s.id as s_id, s.shop_name, s.bio as s_bio, s.shop_story, s.craft_materials,
              s.processing_time, s.delivery_options, s.campus as s_campus,
              s.location_area as s_area, s.location_state as s_state, s.location_city as s_city,
              s.logo_url as s_logo_url, s.banner_url as s_banner_url,
              s.is_verified_seller, s.verification_status, s.under_18 as s_under_18,
              s.vacation_mode, s.created_at as s_created_at, s.rating as s_rating
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE LOWER(u.profile_slug) = LOWER($1) OR u.id = $1 OR s.id = $1
       LIMIT 1`,
      [rawSlug]
    );
    let redirectedFromSlug;
    if (uRes.rows.length === 0) {
      const histRes = await query(
        "SELECT user_id, slug FROM shopit_profile_slug_history WHERE LOWER(slug) = LOWER($1) LIMIT 1",
        [rawSlug]
      );
      if (histRes.rows.length > 0 && histRes.rows[0].user_id) {
        uRes = await query(
          `SELECT u.*, s.id as s_id, s.shop_name, s.bio as s_bio, s.shop_story, s.craft_materials,
                  s.processing_time, s.delivery_options, s.campus as s_campus,
                  s.location_area as s_area, s.location_state as s_state, s.location_city as s_city,
                  s.logo_url as s_logo_url, s.banner_url as s_banner_url,
                  s.is_verified_seller, s.verification_status, s.under_18 as s_under_18,
                  s.vacation_mode, s.created_at as s_created_at, s.rating as s_rating
           FROM shopit_users u
           LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
           WHERE u.id = $1
           LIMIT 1`,
          [histRes.rows[0].user_id]
        );
        if (uRes.rows.length > 0) {
          redirectedFromSlug = rawSlug;
        }
      }
    }
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Profile not found." });
    }
    const row = uRes.rows[0];
    if (row.deleted_at) {
      return res.status(404).json({ status: false, message: "This account has been deleted." });
    }
    const isOwner = Boolean(viewer && viewer.userId === row.id);
    const isAdmin = Boolean(viewer && viewer.role === "admin");
    if (row.is_banned && !isAdmin) {
      return res.status(404).json({ status: false, message: "This profile is currently unavailable." });
    }
    if (viewer && !isOwner && !isAdmin) {
      const blkRes = await query(
        `SELECT blocker_id FROM shopit_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [viewer.userId, row.id]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, blocked: true, message: "This profile is unavailable." });
      }
    }
    const displayName = row.display_name || extractFirstName(row.name || "Member");
    const isUnder18 = row.age !== null && row.age !== void 0 && Number(row.age) < 18 || Boolean(row.s_under_18);
    const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const privacySettings = sanitizePrivacySettings(parseJsonSafe(row.privacy_settings, basePrivacy), basePrivacy, isUnder18);
    let followStatus = "none";
    let isMutualFollow = false;
    let isMuted = false;
    if (viewer && !isOwner) {
      const [fRes, rfRes, mRes] = await Promise.all([
        query("SELECT status FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1", [
          viewer.userId,
          row.id
        ]),
        query(
          "SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1",
          [row.id, viewer.userId]
        ),
        query("SELECT 1 FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2 LIMIT 1", [
          viewer.userId,
          row.id
        ])
      ]);
      if (fRes.rows[0]?.status) {
        followStatus = fRes.rows[0].status === "accepted" ? "accepted" : "pending";
      }
      isMutualFollow = followStatus === "accepted" && rfRes.rows.length > 0;
      isMuted = mRes.rows.length > 0;
    }
    const sellerDelivery = parseJsonSafe(row.delivery_options, { allowsPickup: true, allowsLocalDelivery: true, pickupSpots: [] });
    const sellerRow = row.s_id ? {
      id: row.s_id,
      shop_name: row.shop_name,
      bio: row.s_bio,
      shop_story: row.shop_story,
      craft_materials: row.craft_materials,
      processing_time: row.processing_time,
      delivery_options: {
        allowsPickup: sellerDelivery?.allowsPickup !== false,
        allowsLocalDelivery: sellerDelivery?.allowsLocalDelivery !== false,
        pickupSpots: Array.isArray(sellerDelivery?.pickupSpots) ? sellerDelivery.pickupSpots : []
      },
      campus: row.s_campus,
      location_area: row.s_area,
      location_state: row.s_state,
      location_city: row.s_city,
      logo_url: row.s_logo_url,
      banner_url: row.s_banner_url,
      is_verified_seller: row.is_verified_seller,
      verification_status: row.verification_status,
      vacation_mode: row.vacation_mode,
      created_at: row.s_created_at,
      rating: row.s_rating
    } : null;
    if (privacySettings.profileVisibility === "followers" && !isOwner && !isAdmin && followStatus !== "accepted") {
      const [followersRes, followingRes] = await Promise.all([
        query("SELECT COUNT(*) as total FROM shopit_follows WHERE following_id = $1 AND status = 'accepted'", [row.id]),
        query("SELECT COUNT(*) as total FROM shopit_follows WHERE follower_id = $1 AND status = 'accepted'", [row.id])
      ]);
      return res.json({
        status: true,
        isRestricted: true,
        isOwner: false,
        ...redirectedFromSlug ? { redirectedFromSlug, canonicalSlug: row.profile_slug } : { canonicalSlug: row.profile_slug },
        profile: {
          id: row.id,
          displayName,
          profileSlug: row.profile_slug,
          canonicalSlug: row.profile_slug,
          ...redirectedFromSlug ? { redirectedFromSlug } : {},
          tagline: row.tagline || "",
          role: row.role,
          avatarUrl: row.avatar_url || sellerRow?.logo_url || null,
          coverUrl: row.cover_url || sellerRow?.banner_url || null,
          locationState: row.location_state || sellerRow?.location_state || "",
          campus: row.campus || sellerRow?.campus || "",
          followersCount: parseInt(String(followersRes.rows[0]?.total || "0"), 10),
          followingCount: parseInt(String(followingRes.rows[0]?.total || "0"), 10),
          followStatus,
          isMutualFollow,
          isMuted,
          whoCanFollow: privacySettings.whoCanFollow,
          memberSince: row.created_at,
          isRestricted: true,
          products: [],
          reviews: [],
          badges: [],
          interests: [],
          languages: []
        }
      });
    }
    const prodIds = sellerRow ? [row.id, sellerRow.id] : [row.id];
    const prodIn = buildInClause2(prodIds);
    const pRes = await query(
      `SELECT * FROM shopit_products WHERE seller_id IN (${prodIn.placeholders}) ORDER BY is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC`,
      prodIn.params
    );
    const activeProds = pRes.rows.filter((p) => !p.is_paused && !p.is_draft);
    const visibleProds = isOwner || isAdmin ? pRes.rows : activeProds;
    const stats = await computeComputedSellerStats(row, sellerRow, activeProds, pRes.rows);
    const interests = parseJsonSafe(row.interests, []);
    const languages = parseJsonSafe(row.languages, []);
    const avatarUrl = row.avatar_url || sellerRow?.logo_url || null;
    const coverUrl = row.cover_url || sellerRow?.banner_url || null;
    const mappedProducts = visibleProds.map(
      (p) => mapProductRow(p, displayName, avatarUrl || void 0, row.profile_slug)
    );
    let ownerWishlist = [];
    if (isOwner) {
      const wRes = await query("SELECT product_ids FROM shopit_wishlists WHERE user_id = $1", [row.id]);
      const wishIds = parseJsonSafe(wRes.rows[0]?.product_ids, []);
      if (wishIds.length > 0) {
        const wishIn = buildInClause2(wishIds);
        const wpRes = await query(
          `SELECT * FROM shopit_products WHERE id IN (${wishIn.placeholders}) AND is_paused IS NOT TRUE AND is_draft IS NOT TRUE`,
          wishIn.params
        );
        ownerWishlist = wpRes.rows.map((p) => mapProductRow(p));
      }
    }
    let pendingFollowRequestsCount = 0;
    if (isOwner) {
      const pendRes = await query(
        `SELECT COUNT(*) as total
         FROM shopit_follows f
         JOIN shopit_users fu ON fu.id = f.follower_id
         WHERE f.following_id = $1 AND f.status = 'pending' AND fu.deleted_at IS NULL AND fu.is_banned IS NOT TRUE`,
        [row.id]
      ).catch(() => ({ rows: [{ total: 0 }] }));
      pendingFollowRequestsCount = parseInt(String(pendRes.rows[0]?.total || "0"), 10);
    }
    const completeness = isOwner ? computeProfileCompleteness({
      avatarUrl,
      tagline: row.tagline,
      bio: row.bio || sellerRow?.bio,
      locationState: row.location_state || sellerRow?.location_state,
      campus: row.campus || sellerRow?.campus,
      locationArea: row.location_area || sellerRow?.location_area,
      interests,
      isVerifiedEmail: Boolean(row.is_verified_email),
      isSeller: Boolean(sellerRow),
      shopName: sellerRow?.shop_name,
      shopStory: sellerRow?.shop_story,
      activeProductsCount: activeProds.length
    }) : void 0;
    return res.json({
      status: true,
      isRestricted: false,
      isOwner,
      ...redirectedFromSlug ? { redirectedFromSlug, canonicalSlug: row.profile_slug } : { canonicalSlug: row.profile_slug },
      profile: {
        id: row.id,
        displayName,
        profileSlug: row.profile_slug,
        canonicalSlug: row.profile_slug,
        ...redirectedFromSlug ? { redirectedFromSlug } : {},
        tagline: row.tagline || "",
        role: row.role,
        avatarUrl,
        coverUrl,
        bio: row.bio || sellerRow?.bio || "",
        locationState: row.location_state || sellerRow?.location_state || "",
        campus: row.campus || sellerRow?.campus || "",
        locationArea: row.location_area || sellerRow?.location_area || "",
        interests,
        languages,
        memberSince: row.created_at,
        lastSeenAt: privacySettings.showLastSeen || isOwner || isAdmin ? row.last_seen_at || row.last_login_at || row.created_at : null,
        followStatus,
        isMutualFollow,
        isMuted,
        pendingFollowRequestsCount: isOwner ? pendingFollowRequestsCount : void 0,
        whoCanFollow: privacySettings.whoCanFollow,
        whoCanMessage: privacySettings.whoCanMessage,
        showFollowersList: privacySettings.showFollowersList,
        showFollowingList: privacySettings.showFollowingList,
        ...isOwner ? { privacySettings } : {},
        completeness,
        ...stats,
        products: mappedProducts,
        wishlistProducts: ownerWishlist,
        seller: sellerRow ? {
          id: sellerRow.id,
          shopName: sellerRow.shop_name,
          bio: sellerRow.bio || "",
          shopStory: sellerRow.shop_story || "",
          craftMaterials: sellerRow.craft_materials || "",
          processingTime: sellerRow.processing_time || "",
          deliveryOptions: sellerRow.delivery_options,
          locationState: sellerRow.location_state || row.location_state || "Lagos",
          campus: sellerRow.campus || "Lagos Mainland",
          locationArea: sellerRow.location_area || "Yaba",
          isVerifiedSeller: stats.isVerifiedSeller,
          verificationStatus: sellerRow.verification_status || "not_started",
          vacationMode: Boolean(sellerRow.vacation_mode)
        } : null
      }
    });
  } catch (err) {
    console.error("[GET /profiles/:slug Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to load profile." });
  }
});
var profiles_default = router2;

// server/routes/files.ts
import express3 from "express";
import crypto11 from "crypto";
init_validation();

// server/lib/fileStorage.ts
import crypto10 from "crypto";
import sharp from "sharp";
init_validation();
var MAX_RAW_UPLOAD_BYTES = 4 * 1024 * 1024;
var MAX_PDF_UPLOAD_BYTES = 2 * 1024 * 1024;
var MAX_TXT_UPLOAD_BYTES = 512 * 1024;
var MAX_IMAGE_DIMENSION = 1280;
var TARGET_IMAGE_MAX_BYTES = 400 * 1024;
var PER_USER_STORAGE_LIMIT_BYTES = 25 * 1024 * 1024;
var NEON_FREE_PLAN_LIMIT_MB = 1024;
var DB_STORAGE_ALERT_RATIO = 0.7;
function verifyMagicBytesForImage2(mime, buf) {
  const isJpeg = buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255;
  const isPng = buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10;
  const isWebp = buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  const isGif = buf.length >= 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a");
  if (mime === "image/jpeg") {
    if (!isJpeg) return { ok: false, message: "File content does not match JPEG image signature." };
    const stripped = stripJpegMetadata(buf);
    if (!stripped) return { ok: false, message: "Corrupted JPEG image." };
    return { ok: true, buf: stripped };
  }
  if (mime === "image/png") {
    if (!isPng) return { ok: false, message: "File content does not match PNG image signature." };
    return { ok: true, buf };
  }
  if (mime === "image/webp") {
    if (!isWebp) return { ok: false, message: "File content does not match WebP image signature." };
    return { ok: true, buf };
  }
  if (mime === "image/gif") {
    if (!isGif) return { ok: false, message: "File content does not match GIF image signature." };
    return { ok: true, buf };
  }
  return { ok: false, message: "Unsupported image type." };
}
__name(verifyMagicBytesForImage2, "verifyMagicBytesForImage");
async function optimizeImageBuffer(mimeType, verifiedBuf) {
  try {
    const basePipeline = sharp(verifiedBuf, { failOn: "error", limitInputPixels: 36e6 });
    const meta = await basePipeline.metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, message: "Unable to read image dimensions." };
    }
    const isAnimatedGif = mimeType === "image/gif" && (meta.pages || 1) > 1;
    if (isAnimatedGif && verifiedBuf.length <= TARGET_IMAGE_MAX_BYTES && meta.width <= MAX_IMAGE_DIMENSION && meta.height <= MAX_IMAGE_DIMENSION) {
      return { ok: true, buf: verifiedBuf, mimeType: "image/gif" };
    }
    const resizedPipeline = sharp(verifiedBuf, { limitInputPixels: 36e6 }).rotate().resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true
    });
    const useJpegOutput = mimeType === "image/jpeg";
    const qualitySteps = [82, 70, 58, 46];
    let bestBuf = null;
    const outputMime = useJpegOutput ? "image/jpeg" : "image/webp";
    for (const q of qualitySteps) {
      const candidate = useJpegOutput ? await resizedPipeline.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer() : await resizedPipeline.clone().webp({ quality: q }).toBuffer();
      bestBuf = candidate;
      if (candidate.length <= TARGET_IMAGE_MAX_BYTES) {
        break;
      }
    }
    if (bestBuf && bestBuf.length > TARGET_IMAGE_MAX_BYTES) {
      const tighter = sharp(verifiedBuf, { limitInputPixels: 36e6 }).rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true });
      bestBuf = useJpegOutput ? await tighter.jpeg({ quality: 55, mozjpeg: true }).toBuffer() : await tighter.webp({ quality: 55 }).toBuffer();
    }
    if (!bestBuf || bestBuf.length === 0) {
      return { ok: false, message: "Image optimization produced empty output." };
    }
    if (bestBuf.length > TARGET_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        message: "Image could not be compressed under 400 KB. Please choose a smaller or less complex image."
      };
    }
    return { ok: true, buf: bestBuf, mimeType: outputMime };
  } catch (err) {
    if (verifiedBuf.length <= 1024) {
      return { ok: true, buf: verifiedBuf, mimeType };
    }
    return {
      ok: false,
      message: "Corrupted or unsupported image file. Please upload a valid JPG, PNG, WebP, or GIF image."
    };
  }
}
__name(optimizeImageBuffer, "optimizeImageBuffer");
async function processAndValidateUpload(params) {
  const { dataUrl, fileName, purpose } = params;
  if (typeof dataUrl !== "string" || !dataUrl.trim()) {
    return { valid: false, message: "File data URL is required." };
  }
  const rawName = String(fileName || "upload").trim();
  const cleanName = rawName.replace(/[\r\n\0/\\]+/g, "_").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "upload";
  const match = /^data:([a-z0-9+.-]+\/[a-z0-9+.-]+)(?:;[a-z0-9=_-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim()
  );
  if (!match) {
    return {
      valid: false,
      message: "Invalid file format. Please upload a JPG, PNG, WebP, GIF, PDF, or TXT file."
    };
  }
  let mimeType = match[1].toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (mimeType.includes("svg") || mimeType.includes("html") || mimeType.includes("javascript") || mimeType.includes("xml")) {
    return { valid: false, message: "SVG, HTML, and script files are blocked for security." };
  }
  const base64Body = match[2].replace(/\s+/g, "");
  const rawBuf = Buffer.from(base64Body, "base64");
  if (rawBuf.length === 0 || rawBuf.length > MAX_RAW_UPLOAD_BYTES) {
    return { valid: false, statusCode: 413, message: "File rejected: maximum raw upload size is 4 MB." };
  }
  const isImageMime = mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp" || mimeType === "image/gif";
  if (isImageMime) {
    const magic = verifyMagicBytesForImage2(mimeType, rawBuf);
    if (!magic.ok) {
      return { valid: false, message: magic.message };
    }
    const optimized = await optimizeImageBuffer(mimeType, magic.buf);
    if (!optimized.ok) {
      return { valid: false, message: optimized.message };
    }
    const finalBuf = optimized.buf;
    const sha256 = crypto10.createHash("sha256").update(finalBuf).digest("hex");
    return {
      valid: true,
      mimeType: optimized.mimeType,
      sizeBytes: finalBuf.length,
      base64Data: finalBuf.toString("base64"),
      cleanName,
      kind: "image",
      sha256
    };
  }
  if (purpose === "chat" && (mimeType === "application/pdf" || mimeType === "text/plain")) {
    if (mimeType === "application/pdf") {
      if (rawBuf.length > MAX_PDF_UPLOAD_BYTES) {
        return { valid: false, statusCode: 413, message: "PDF files must be 2 MB or smaller." };
      }
      const hasPdfSig = rawBuf.length >= 5 && rawBuf.subarray(0, 5).toString("ascii") === "%PDF-";
      if (!hasPdfSig) {
        return { valid: false, message: "File content does not match a valid PDF document." };
      }
    } else {
      if (rawBuf.length > MAX_TXT_UPLOAD_BYTES) {
        return { valid: false, statusCode: 413, message: "Text attachments must be 512 KB or smaller." };
      }
      if (rawBuf.includes(0)) {
        return { valid: false, message: "Binary data is not allowed inside a plain-text file." };
      }
      const txt = rawBuf.toString("utf8");
      if (/<script|<iframe|javascript:/i.test(txt)) {
        return { valid: false, message: "Text attachment contains disallowed script/HTML markup." };
      }
    }
    const sha256 = crypto10.createHash("sha256").update(rawBuf).digest("hex");
    return {
      valid: true,
      mimeType,
      sizeBytes: rawBuf.length,
      base64Data: rawBuf.toString("base64"),
      cleanName,
      kind: "document",
      sha256
    };
  }
  return {
    valid: false,
    message: purpose === "chat" ? "Only JPG, PNG, WebP, GIF, PDF, or TXT files are allowed in chat." : "Only JPG, PNG, WebP, or GIF image files are allowed for this upload."
  };
}
__name(processAndValidateUpload, "processAndValidateUpload");
var PostgresFileStorage = class {
  static {
    __name(this, "PostgresFileStorage");
  }
  async saveFile(input) {
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await query(
      `INSERT INTO shopit_files (
        id, owner_id, purpose, original_name, mime_type, size_bytes, sha256, data_base64, is_public, conversation_id, order_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        input.id,
        input.ownerId,
        input.purpose,
        input.originalName,
        input.mimeType,
        input.sizeBytes,
        input.sha256,
        input.base64Data,
        input.isPublic,
        input.conversationId || null,
        input.orderId || null
      ]
    );
    return {
      id: input.id,
      ownerId: input.ownerId,
      purpose: input.purpose,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      isPublic: input.isPublic,
      conversationId: input.conversationId || void 0,
      orderId: input.orderId || void 0,
      createdAt: nowIso
    };
  }
  async getFileById(id) {
    const result = await query(
      `SELECT id, owner_id, purpose, original_name, mime_type, size_bytes, sha256, data_base64, is_public, conversation_id, order_id, created_at
       FROM shopit_files
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      ownerId: row.owner_id,
      purpose: row.purpose,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes || 0),
      sha256: row.sha256,
      dataBase64: row.data_base64,
      isPublic: Boolean(row.is_public),
      conversationId: row.conversation_id || void 0,
      orderId: row.order_id || void 0,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  // Strictly metadata-only: never selects data_base64 in list queries
  async listUserFilesMetadata(ownerId, limit = 100) {
    const safeLimit = Math.min(200, Math.max(1, limit));
    const result = await query(
      `SELECT id, owner_id, purpose, original_name, mime_type, size_bytes, sha256, is_public, conversation_id, order_id, created_at
       FROM shopit_files
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [ownerId, safeLimit]
    );
    return result.rows.map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      purpose: r.purpose,
      originalName: r.original_name,
      mimeType: r.mime_type,
      sizeBytes: Number(r.size_bytes || 0),
      sha256: r.sha256,
      isPublic: Boolean(r.is_public),
      conversationId: r.conversation_id || void 0,
      orderId: r.order_id || void 0,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
  async getUserStorageUsage(ownerId) {
    const res = await query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes, COUNT(*)::int AS file_count
       FROM shopit_files
       WHERE owner_id = $1`,
      [ownerId]
    );
    const usedBytes = Number(res.rows[0]?.used_bytes || 0);
    const fileCount = Number(res.rows[0]?.file_count || 0);
    return {
      usedBytes,
      limitBytes: PER_USER_STORAGE_LIMIT_BYTES,
      remainingBytes: Math.max(0, PER_USER_STORAGE_LIMIT_BYTES - usedBytes),
      fileCount
    };
  }
  async deleteFile(id) {
    await query("DELETE FROM shopit_files WHERE id = $1", [id]);
  }
  async deleteUserFiles(ownerId) {
    const res = await query("DELETE FROM shopit_files WHERE owner_id = $1 RETURNING id", [ownerId]);
    return res.rows.length;
  }
  async deleteConversationFiles(conversationId) {
    if (!conversationId) return 0;
    const res = await query("DELETE FROM shopit_files WHERE conversation_id = $1 RETURNING id", [conversationId]);
    return res.rows.length;
  }
  async cleanupOrphanedFiles() {
    let deletedCount = 0;
    try {
      const r1 = await query(
        `DELETE FROM shopit_files
         WHERE conversation_id IS NOT NULL
           AND conversation_id NOT IN (SELECT id FROM shopit_chat_conversations WHERE id IS NOT NULL)
         RETURNING id`
      );
      deletedCount += r1.rows.length;
    } catch {
    }
    try {
      const r2 = await query(
        `DELETE FROM shopit_files
         WHERE order_id IS NOT NULL
           AND order_id NOT IN (SELECT id FROM shopit_orders WHERE id IS NOT NULL)
         RETURNING id`
      );
      deletedCount += r2.rows.length;
    } catch {
    }
    try {
      const r3 = await query(
        `DELETE FROM shopit_files
         WHERE purpose IN ('chat', 'packed_proof', 'dispute')
           AND conversation_id IS NULL
           AND order_id IS NULL
           AND created_at < NOW() - INTERVAL '24 hours'
         RETURNING id`
      );
      deletedCount += r3.rows.length;
    } catch {
    }
    return { deletedCount };
  }
};
var fileStorage = new PostgresFileStorage();

// server/routes/files.ts
var router3 = express3.Router();
var PUBLIC_PURPOSES = /* @__PURE__ */ new Set(["avatar", "cover", "product"]);
function isConversationParticipant(convRow, userId, sellerId) {
  if (!convRow) return false;
  if (convRow.buyer_id === userId) return true;
  if (convRow.seller_id === userId) return true;
  if (sellerId && convRow.seller_id === sellerId) return true;
  return false;
}
__name(isConversationParticipant, "isConversationParticipant");
function isOrderParticipant(orderRow, userId, sellerId) {
  if (!orderRow) return false;
  if (orderRow.buyer_id === userId) return true;
  const items = Array.isArray(orderRow.items) ? orderRow.items : typeof orderRow.items === "string" ? (() => {
    try {
      return JSON.parse(orderRow.items);
    } catch {
      return [];
    }
  })() : [];
  return items.some(
    (it) => it?.sellerId === userId || sellerId && it?.sellerId === sellerId
  );
}
__name(isOrderParticipant, "isOrderParticipant");
router3.post("/files/upload", requireAuth, async (req, res) => {
  try {
    const caller = req.user;
    const check = rejectUnknownFields(req.body, [
      "dataUrl",
      "fileName",
      "purpose",
      "conversationId",
      "orderId"
    ]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { dataUrl, fileName, purpose: rawPurpose, conversationId, orderId } = check.obj;
    const purpose = String(rawPurpose || "general").trim();
    if (!ALLOWED_UPLOAD_PURPOSES.includes(purpose)) {
      return res.status(400).json({ status: false, message: "Invalid upload purpose." });
    }
    const rl = await checkAndRecordRateLimit(`file_upload:${caller.userId}`, 45, 10 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({
        status: false,
        message: "Too many file uploads. Please wait a few minutes and try again."
      });
    }
    const cleanConversationId = conversationId ? String(conversationId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;
    if (cleanConversationId) {
      const convRes = await query(
        "SELECT id, buyer_id, seller_id FROM shopit_chat_conversations WHERE id = $1 LIMIT 1",
        [cleanConversationId]
      );
      if (convRes.rows.length === 0) {
        return res.status(404).json({ status: false, message: "Conversation not found." });
      }
      if (caller.role !== "admin" && !isConversationParticipant(convRes.rows[0], caller.userId, caller.sellerId)) {
        return res.status(403).json({ status: false, message: "You are not a participant in this conversation." });
      }
    }
    if (cleanOrderId) {
      const ordRes = await query(
        "SELECT id, buyer_id, items FROM shopit_orders WHERE id = $1 LIMIT 1",
        [cleanOrderId]
      );
      if (ordRes.rows.length === 0) {
        return res.status(404).json({ status: false, message: "Order not found." });
      }
      if (caller.role !== "admin" && !isOrderParticipant(ordRes.rows[0], caller.userId, caller.sellerId)) {
        return res.status(403).json({ status: false, message: "You are not authorized to attach files to this order." });
      }
    }
    const validated = await processAndValidateUpload({ dataUrl, fileName, purpose });
    if (!validated.valid) {
      return res.status(validated.statusCode || 400).json({ status: false, message: validated.message });
    }
    const usage = await fileStorage.getUserStorageUsage(caller.userId);
    if (usage.usedBytes + validated.sizeBytes > usage.limitBytes) {
      return res.status(413).json({
        status: false,
        error: "STORAGE_QUOTA_EXCEEDED",
        message: "You have reached the 25 MB account storage limit. Delete old files to upload new ones.",
        usage
      });
    }
    const fileId = "file_" + crypto11.randomBytes(12).toString("hex");
    const isPublic = PUBLIC_PURPOSES.has(purpose);
    const saved = await fileStorage.saveFile({
      id: fileId,
      ownerId: caller.userId,
      purpose,
      originalName: validated.cleanName,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      sha256: validated.sha256,
      base64Data: validated.base64Data,
      isPublic,
      conversationId: cleanConversationId,
      orderId: cleanOrderId
    });
    await logAuditEvent({
      action: "FILE_UPLOADED",
      actor: { id: caller.userId, email: caller.email, role: caller.role },
      target: { type: "file", id: fileId },
      details: {
        purpose,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        isPublic,
        conversationId: cleanConversationId,
        orderId: cleanOrderId
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    const url = `/api/files/${fileId}`;
    return res.status(201).json({
      status: true,
      file: {
        id: saved.id,
        url,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        kind: validated.kind,
        purpose: saved.purpose,
        isPublic: saved.isPublic,
        createdAt: saved.createdAt
      },
      usage: {
        usedBytes: usage.usedBytes + saved.sizeBytes,
        limitBytes: usage.limitBytes,
        remainingBytes: Math.max(0, usage.limitBytes - (usage.usedBytes + saved.sizeBytes)),
        fileCount: usage.fileCount + 1
      }
    });
  } catch (err) {
    console.error("[Files Upload Error]:", err?.message || err);
    return res.status(500).json({ status: false, message: "Failed to store uploaded file." });
  }
});
router3.get("/files/mine", requireAuth, async (req, res) => {
  try {
    const caller = req.user;
    const [rows, usage] = await Promise.all([
      fileStorage.listUserFilesMetadata(caller.userId, 100),
      fileStorage.getUserStorageUsage(caller.userId)
    ]);
    const files = rows.map((r) => ({
      id: r.id,
      url: `/api/files/${r.id}`,
      purpose: r.purpose,
      originalName: r.originalName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      kind: String(r.mimeType || "").startsWith("image/") ? "image" : "document",
      isPublic: r.isPublic,
      conversationId: r.conversationId,
      orderId: r.orderId,
      createdAt: r.createdAt
    }));
    return res.json({ status: true, files, usage });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Unable to fetch your uploaded files." });
  }
});
router3.get("/files/:id", optionalAuth, async (req, res) => {
  try {
    const fileId = String(req.params.id || "").trim();
    if (!/^file_[a-zA-Z0-9_-]+$/.test(fileId)) {
      return res.status(404).json({ status: false, message: "File not found." });
    }
    const row = await fileStorage.getFileById(fileId);
    if (!row) {
      return res.status(404).json({ status: false, message: "File not found." });
    }
    const mustBeAuthorized = !row.isPublic || !PUBLIC_PURPOSES.has(row.purpose);
    if (mustBeAuthorized) {
      const caller = req.user;
      if (!caller) {
        return res.status(401).json({ status: false, message: "Sign in required to access this private file." });
      }
      let authorized = caller.role === "admin" || row.ownerId === caller.userId;
      if (!authorized && row.conversationId) {
        const convRes = await query(
          "SELECT buyer_id, seller_id FROM shopit_chat_conversations WHERE id = $1 LIMIT 1",
          [row.conversationId]
        );
        if (convRes.rows.length > 0 && isConversationParticipant(convRes.rows[0], caller.userId, caller.sellerId)) {
          authorized = true;
        }
      }
      if (!authorized && row.orderId) {
        const ordRes = await query(
          "SELECT buyer_id, items FROM shopit_orders WHERE id = $1 LIMIT 1",
          [row.orderId]
        );
        if (ordRes.rows.length > 0 && isOrderParticipant(ordRes.rows[0], caller.userId, caller.sellerId)) {
          authorized = true;
        }
      }
      if (!authorized) {
        return res.status(403).json({ status: false, message: "You do not have permission to view this file." });
      }
    }
    const buf = Buffer.from(String(row.dataBase64 || ""), "base64");
    const isImage = String(row.mimeType || "").startsWith("image/");
    const forceDownload = req.query.download === "1" || !isImage;
    const safeFileName = String(row.originalName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      mustBeAuthorized ? "private, max-age=3600" : "public, max-age=86400"
    );
    res.setHeader(
      "Content-Disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${safeFileName}"`
    );
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[Files Serve Error]:", err?.message || err);
    return res.status(500).json({ status: false, message: "Failed to load file." });
  }
});
router3.delete("/files/:id", requireAuth, async (req, res) => {
  try {
    const caller = req.user;
    const fileId = String(req.params.id || "").trim();
    const existing = await query("SELECT id, owner_id FROM shopit_files WHERE id = $1 LIMIT 1", [fileId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: "File not found." });
    }
    const row = existing.rows[0];
    if (caller.role !== "admin" && row.owner_id !== caller.userId) {
      return res.status(403).json({ status: false, message: "You can only delete files you uploaded." });
    }
    await fileStorage.deleteFile(fileId);
    await logAuditEvent({
      action: "FILE_DELETED",
      actor: { id: caller.userId, email: caller.email, role: caller.role },
      target: { type: "file", id: fileId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "File deleted." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to delete file." });
  }
});
var files_default = router3;

// server/app.ts
init_minorSafety();
validateAppSecret();
var sendAdminAlert2 = sendAdminAlert;
var IS_PROD2 = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
if (!isProdRuntime()) {
  runMigration().catch((err) => {
    console.error("[PostgreSQL Startup Migration Error]:", err.message);
  });
} else {
  verifyDatabaseSchema().then((status) => {
    if (!status.ok) {
      console.error("[PostgreSQL Schema Check Failed]:", status.migrationError || status.error);
    }
  }).catch((err) => {
    console.error("[PostgreSQL Schema Check Error]:", err.message);
  });
}
var app = express4();
app.use(cookieParser());
var PRODUCTION_APP_URL = "https://shopitng.vercel.app";
var REDIRECT_APP_URL = "https://shop-itng-pied.vercel.app";
var APP_URL = (process.env.APP_URL || PRODUCTION_APP_URL).replace(/\/$/, "");
function normalizeOriginUrl(raw) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}
__name(normalizeOriginUrl, "normalizeOriginUrl");
function getRequestHostOrigin(req) {
  if (!req) return "";
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  const protoHeader = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim().toLowerCase();
  if (!hostHeader) return "";
  const scheme = protoHeader === "http" ? "http" : "https";
  return normalizeOriginUrl(`${scheme}://${hostHeader}`);
}
__name(getRequestHostOrigin, "getRequestHostOrigin");
function getAllowedOrigins(req) {
  const extra = (process.env.ALLOWED_ORIGINS || "").split(",").map(normalizeOriginUrl).filter(Boolean);
  const ngAllowedHosts = (process.env.NG_ALLOWED_HOSTS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const sameHostOrigins = [];
  const requestHostOrigin = getRequestHostOrigin(req);
  if (requestHostOrigin) {
    sameHostOrigins.push(requestHostOrigin);
  }
  if (req && (!IS_PROD2 || ngAllowedHosts.length > 0)) {
    const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
    const protoHeader = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim().toLowerCase();
    if (hostHeader) {
      const cleanHost = hostHeader.replace(/:\d+$/, "");
      const isAllowedDynamicHost = !IS_PROD2 && (cleanHost === "localhost" || cleanHost === "127.0.0.1") || ngAllowedHosts.includes(cleanHost);
      if (isAllowedDynamicHost) {
        sameHostOrigins.push(normalizeOriginUrl(`${protoHeader === "http" ? "http" : "https"}://${hostHeader}`));
      }
    }
  }
  const defaults = [
    PRODUCTION_APP_URL,
    REDIRECT_APP_URL,
    APP_URL,
    ...sameHostOrigins,
    ...IS_PROD2 ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"]
  ].map(normalizeOriginUrl);
  return Array.from(new Set([...defaults, ...extra].filter(Boolean)));
}
__name(getAllowedOrigins, "getAllowedOrigins");
async function checkStorageThresholdAlert(databaseSizeMb) {
  const thresholdMb = NEON_FREE_PLAN_LIMIT_MB * DB_STORAGE_ALERT_RATIO;
  if (!Number.isFinite(databaseSizeMb) || databaseSizeMb < thresholdMb) return;
  const dayKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  await sendAdminAlert(
    `db_storage_70pct_${dayKey}`,
    `Database Storage Alert (${databaseSizeMb} MB / ${NEON_FREE_PLAN_LIMIT_MB} MB)`,
    `PostgreSQL database size reached <strong>${databaseSizeMb} MB</strong>, exceeding the 70% threshold (${thresholdMb.toFixed(1)} MB of ${NEON_FREE_PLAN_LIMIT_MB} MB Neon Free plan). Review stored files or upgrade storage before hitting 1 GB.`
  ).catch(() => {
  });
}
__name(checkStorageThresholdAlert, "checkStorageThresholdAlert");
function escapeHtml(raw) {
  return String(raw ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
__name(escapeHtml, "escapeHtml");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self)");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; frame-src 'self' https://checkout.flutterwave.com https://checkout-v2.flutterwave.com https://*.flutterwave.com; connect-src 'self' https://api.flutterwave.com https://checkout.flutterwave.com https://api.brevo.com https://*.ingest.sentry.io https://*.upstash.io https://vitals.vercel-insights.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:;"
  );
  next();
});
app.use(
  express4.json({
    limit: "8mb",
    verify: /* @__PURE__ */ __name((req, _res, buf) => {
      req.rawBody = buf;
    }, "verify")
  })
);
app.use((req, res, next) => {
  const originHeader = req.headers.origin ? normalizeOriginUrl(String(req.headers.origin)) : "";
  const allowedOrigins = getAllowedOrigins(req);
  const isWebhookPath = req.path === "/webhooks/flutterwave" || req.path === "/api/webhooks/flutterwave";
  if (isWebhookPath) {
    return next();
  }
  const isOriginAllowed = !originHeader || allowedOrigins.includes(originHeader);
  if (originHeader && isOriginAllowed) {
    res.setHeader("Access-Control-Allow-Origin", originHeader);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-session-token, verif-hash"
  );
  if (req.method === "OPTIONS") {
    if (originHeader && !isOriginAllowed) {
      return res.status(403).json({ status: false, error: "CORS_ORIGIN_FORBIDDEN", message: "Origin not allowed." });
    }
    return res.status(204).end();
  }
  if (originHeader && !isOriginAllowed && !["GET", "HEAD"].includes(req.method)) {
    return res.status(403).json({ status: false, error: "CORS_ORIGIN_FORBIDDEN", message: "Origin not allowed." });
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const hasCookieSession = Boolean(req.cookies?.[SESSION_COOKIE_NAME]);
    const hasExplicitTokenHeader = Boolean(req.headers.authorization || req.headers["x-session-token"]);
    if (hasCookieSession && !hasExplicitTokenHeader) {
      let refererOrigin = "";
      if (!originHeader && req.headers.referer) {
        try {
          refererOrigin = normalizeOriginUrl(new URL(String(req.headers.referer)).origin);
        } catch {
        }
      }
      const effectiveOrigin = originHeader || refererOrigin;
      const secFetchSite = String(req.headers["sec-fetch-site"] || "").trim().toLowerCase();
      const isTrustedSameOrigin = Boolean(effectiveOrigin && allowedOrigins.includes(effectiveOrigin)) || !originHeader && !refererOrigin && secFetchSite === "same-origin";
      if (!isTrustedSameOrigin) {
        return res.status(403).json({ status: false, error: "CSRF_ORIGIN_FORBIDDEN", message: "Invalid request origin." });
      }
    }
  }
  next();
});
function getFlwSecretKey() {
  return (process.env.FLW_SECRET_KEY || "").trim().replace(/^["']|["']$/g, "");
}
__name(getFlwSecretKey, "getFlwSecretKey");
function getFlwWebhookHash() {
  return (process.env.FLW_WEBHOOK_SECRET_HASH || "").trim().replace(/^["']|["']$/g, "");
}
__name(getFlwWebhookHash, "getFlwWebhookHash");
function getFlwPublicKey() {
  return (process.env.FLW_PUBLIC_KEY || process.env.VITE_FLW_PUBLIC_KEY || "").trim().replace(/^["']|["']$/g, "");
}
__name(getFlwPublicKey, "getFlwPublicKey");
function hashNin(nin) {
  const ninKey = deriveSubKey("nin-hash", 32);
  return crypto12.createHmac("sha256", ninKey).update(nin.trim()).digest("hex");
}
__name(hashNin, "hashNin");
var VALID_EMAIL_TEMPLATES = /* @__PURE__ */ new Set([
  "signup_code",
  "new_device_login",
  "password_reset",
  "withdrawal_code",
  "new_payout_account_code",
  "order_placed_buyer",
  "new_order_seller",
  "order_shipped_buyer",
  "item_received_seller",
  "auto_release_reminder",
  "dispute_opened",
  "dispute_resolved",
  "seller_verified",
  "verification_not_approved",
  "welcome",
  "email_change"
]);
var router4 = express4.Router();
router4.use(marketplace_default);
router4.use(profiles_default);
router4.use(files_default);
var APP_BUILT_AT = (/* @__PURE__ */ new Date()).toISOString();
router4.get("/version", (_req, res) => {
  return res.status(200).json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local",
    builtAt: process.env.VERCEL_BUILD_COMPLETED_AT || APP_BUILT_AT
  });
});
router4.get(["/health", "/api/health"], async (_req, res) => {
  const [pgPing, redisPing, dbStats] = await Promise.all([
    pingPostgres(),
    pingRedis(),
    getDatabaseHealthStats()
  ]);
  const isPgOk = pgPing.ok;
  const hasRedisConfig = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  const isRedisOk = !hasRedisConfig || redisPing.ok;
  const flutterwaveConfigured = Boolean(getFlwSecretKey() && getFlwPublicKey() && getFlwWebhookHash());
  const paymentsEnabledFlag = String(process.env.PAYMENTS_ENABLED || "").toLowerCase() === "true";
  const payoutsEnabledFlag = String(process.env.PAYOUTS_ENABLED || "").toLowerCase() === "true";
  const migrationError = pgPing.migrationError ? String(pgPing.migrationError).replace(/postgres(ql)?:\/\/[^\s]+/gi, "[redacted-url]").slice(0, 240) : null;
  if (isPgOk && isRedisOk) {
    return res.status(200).json({
      status: "OK",
      database: pgPing.provider,
      databaseConnected: true,
      databaseHost: dbStats.databaseHost,
      tableCount: dbStats.tableCount,
      databaseSizeMb: dbStats.databaseSizeMb,
      fileStorageBytes: dbStats.fileStorageBytes,
      fileStorageMb: dbStats.fileStorageMb,
      fileCount: dbStats.fileCount,
      flutterwaveConfigured,
      paymentsEnabled: paymentsEnabledFlag,
      payoutsEnabled: payoutsEnabledFlag,
      schemaOk: Boolean(pgPing.schemaOk),
      schemaVersion: pgPing.schemaVersion ?? null,
      expectedSchemaVersion: pgPing.expectedSchemaVersion ?? EXPECTED_SCHEMA_VERSION,
      migrationError,
      ...pgPing.missingTables && pgPing.missingTables.length > 0 ? { missingTables: pgPing.missingTables } : {},
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  const failingServices = [];
  if (!isPgOk) failingServices.push("PostgreSQL");
  if (!isRedisOk) failingServices.push("Upstash Redis");
  const safeDbError = pgPing.error ? String(pgPing.error).replace(/postgres(ql)?:\/\/[^\s]+/gi, "[redacted-url]").slice(0, 180) : void 0;
  return res.status(503).json({
    status: "ERROR",
    failing: failingServices.join(", "),
    databaseConnected: isPgOk,
    databaseHost: dbStats.databaseHost,
    tableCount: dbStats.tableCount,
    databaseSizeMb: dbStats.databaseSizeMb,
    flutterwaveConfigured,
    paymentsEnabled: paymentsEnabledFlag,
    payoutsEnabled: payoutsEnabledFlag,
    schemaOk: Boolean(pgPing.schemaOk),
    schemaVersion: pgPing.schemaVersion ?? null,
    expectedSchemaVersion: pgPing.expectedSchemaVersion ?? EXPECTED_SCHEMA_VERSION,
    migrationError,
    ...pgPing.missingTables && pgPing.missingTables.length > 0 ? { missingTables: pgPing.missingTables } : {},
    ...safeDbError ? { error: safeDbError } : {},
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
router4.get("/platform/config", async (_req, res) => {
  try {
    const config2 = await getAllPlatformConfig();
    const paymentsEnabledFlag = String(process.env.PAYMENTS_ENABLED || "").toLowerCase() === "true";
    const payoutsEnabledFlag = String(process.env.PAYOUTS_ENABLED || "").toLowerCase() === "true";
    return res.json({
      status: true,
      ...config2,
      paymentsEnabled: paymentsEnabledFlag,
      payoutsEnabled: payoutsEnabledFlag
    });
  } catch (err) {
    console.error("[Platform Config Read Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to load platform configuration from database." });
  }
});
router4.post(["/auth/register", "/auth/signup"], async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "buyer",
      age,
      hasGuardianConsent,
      guardianName,
      shopName,
      campus,
      location,
      bio,
      signupVerificationToken
    } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ status: false, message: "Name, email, and password are required." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanPassword = String(password).trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      return res.status(400).json({ status: false, message: "Name must be between 2 and 120 characters." });
    }
    const nameContactCheck = containsForbiddenContactInfo(cleanName);
    if (nameContactCheck.blocked) {
      return res.status(400).json({ status: false, message: `Name: ${nameContactCheck.reason}` });
    }
    if (shopName) {
      const shopContactCheck = containsForbiddenContactInfo(String(shopName));
      if (shopContactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Shop name: ${shopContactCheck.reason}` });
      }
    }
    if (bio) {
      const bioContactCheck = containsForbiddenContactInfo(String(bio));
      if (bioContactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Bio: ${bioContactCheck.reason}` });
      }
    }
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ status: false, message: "Please provide a valid email address." });
    }
    if (cleanPassword.length < 8 || cleanPassword.length > 128) {
      return res.status(400).json({ status: false, message: "Password must be between 8 and 128 characters long." });
    }
    if (age === void 0 || age === null || String(age).trim() === "") {
      return res.status(400).json({ status: false, message: "Age is required to register on Shop It." });
    }
    const parsedAge = parseInt(String(age), 10);
    if (isNaN(parsedAge) || parsedAge < MINIMUM_PLATFORM_AGE || parsedAge > 120) {
      return res.status(400).json({ status: false, message: `You must be at least ${MINIMUM_PLATFORM_AGE} years old to register on Shop It.` });
    }
    if (isMinorAccount({ age: parsedAge }) && (!hasGuardianConsent || !guardianName || !String(guardianName).trim())) {
      return res.status(400).json({
        status: false,
        message: "Parent or guardian consent and guardian name are required for users under 18."
      });
    }
    const cleanVerificationToken = String(signupVerificationToken || "").trim();
    if (!cleanVerificationToken) {
      return res.status(403).json({
        status: false,
        error: "EMAIL_OTP_REQUIRED",
        message: "Please verify your 6-digit email verification code before completing registration."
      });
    }
    const userRole = role === "seller" ? "seller" : "buyer";
    const userId = `user_${Date.now()}_${crypto12.randomBytes(4).toString("hex")}`;
    const passwordHash = hashPassword(cleanPassword);
    const defaultDisplayName = extractFirstName(cleanName);
    const resolvedCampus = campus ? String(campus).trim() : userRole === "seller" ? "Lagos Mainland" : "";
    const resolvedArea = location?.area ? String(location.area).trim() : userRole === "seller" ? "Yaba" : "";
    const resolvedBio = bio ? String(bio).trim().slice(0, 200) : "";
    const isVerifiedEmail = true;
    const initialPrivacy = isMinorAccount({ age: parsedAge }) ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const txResult = await withTransaction(async (client) => {
      const existing = await client.query("SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1)", [cleanEmail]);
      if (existing.rows.length > 0) {
        return { conflict: true };
      }
      const verifiedConsumed = await consumeSignupVerificationTokenInTx(client, cleanEmail, cleanVerificationToken);
      if (!verifiedConsumed) {
        return { unverifiedSignup: true };
      }
      const profileSlug = await generateUniqueProfileSlug(
        (sql, p) => client.query(sql, p),
        defaultDisplayName
      );
      const userInsert = await client.query(
        `INSERT INTO shopit_users (
          id, email, name, display_name, profile_slug, bio, campus, location_area,
          interests, notification_prefs, privacy_settings,
          password_hash, role, is_verified_email, age, has_guardian_consent, guardian_name,
          last_seen_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, NOW(), NOW(), NOW())
        RETURNING id, email, name, display_name, profile_slug, avatar_url, cover_url, bio, campus, location_area, interests, notification_prefs, privacy_settings, role, is_verified_email, age, has_guardian_consent, guardian_name, created_at`,
        [
          userId,
          cleanEmail,
          cleanName,
          defaultDisplayName,
          profileSlug,
          resolvedBio,
          resolvedCampus || null,
          resolvedArea || null,
          JSON.stringify(DEFAULT_NOTIFICATION_PREFS),
          JSON.stringify(initialPrivacy),
          passwordHash,
          userRole,
          isVerifiedEmail,
          parsedAge,
          parsedAge < 18 ? Boolean(hasGuardianConsent) : true,
          guardianName ? String(guardianName).trim() : null
        ]
      );
      let sellerProfile = null;
      if (userRole === "seller") {
        const cleanShop = (shopName || `${defaultDisplayName}'s Shop`).trim();
        const sellerInsert = await client.query(
          `INSERT INTO shopit_sellers (
            id, user_id, shop_name, owner_name, email, bio, campus, location_state, location_city, location_area,
            is_verified_seller, verification_status, under_18, guardian_consent, guardian_name, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, 'not_started', $11, $12, $13, NOW(), NOW())
          RETURNING *`,
          [
            userId,
            userId,
            cleanShop,
            defaultDisplayName,
            cleanEmail,
            bio ? String(bio).trim() : "",
            campus ? String(campus).trim() : "Lagos Mainland",
            location?.state || "Lagos",
            location?.city || "Lagos Mainland",
            location?.area || "Yaba",
            parsedAge < 18,
            Boolean(hasGuardianConsent),
            guardianName ? String(guardianName).trim() : null
          ]
        );
        sellerProfile = sellerInsert.rows[0];
        await client.query(
          `INSERT INTO shopit_wallets (seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, is_frozen, created_at, updated_at)
           VALUES ($1, 0, 0, 0, false, NOW(), NOW())
           ON CONFLICT (seller_id) DO NOTHING`,
          [userId]
        );
      }
      const roleLabel = userRole === "seller" ? "Seller" : "Buyer";
      const txShopName = sellerProfile?.shop_name || (shopName ? String(shopName).trim() : null);
      const txCampus = sellerProfile?.campus || (campus ? String(campus).trim() : null);
      const txArea = sellerProfile?.location_area || location?.area || null;
      const alertTitle = `New ${roleLabel} Registered: ${cleanName}`;
      const alertMsg = userRole === "seller" ? `${cleanName} (${cleanEmail}) registered Seller Shop "${txShopName || cleanName}" at ${txCampus || "Campus"}.` : `${cleanName} (${cleanEmail}) joined Shop It as a Buyer (Age ${parsedAge}).`;
      await client.query(
        `INSERT INTO shopit_admin_alerts (
          alert_key, id, alert_type, user_id, user_email, user_name, user_role,
          title, message, is_read, metadata, created_at
        ) VALUES ($1, $2, 'new_user', $3, $4, $5, $6, $7, $8, false, $9::jsonb, NOW())
        ON CONFLICT (alert_key) DO NOTHING`,
        [
          `new_user_${userId}`,
          `alert_user_${userId}`,
          userId,
          cleanEmail,
          cleanName,
          userRole,
          alertTitle,
          alertMsg,
          JSON.stringify({
            shopName: txShopName,
            campus: txCampus,
            locationArea: txArea,
            age: parsedAge,
            isVerifiedEmail
          })
        ]
      );
      const adminUsersRes = await client.query("SELECT id FROM shopit_users WHERE role = 'admin'");
      for (const adm of adminUsersRes.rows) {
        await client.query(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, $3, $4, 'info', false, '/admin', NOW())`,
          [
            `notif_new_user_${Date.now()}_${crypto12.randomBytes(3).toString("hex")}`,
            adm.id,
            alertTitle,
            alertMsg
          ]
        );
      }
      return { conflict: false, unverifiedSignup: false, savedUser: userInsert.rows[0], sellerProfile };
    });
    if (txResult.conflict) {
      return res.status(409).json({
        status: false,
        message: "An account with this email address already exists. Please log in."
      });
    }
    if (txResult.unverifiedSignup) {
      return res.status(403).json({
        status: false,
        error: "EMAIL_OTP_REQUIRED",
        message: "Your email verification code is missing, expired, or already used. Please verify a new 6-digit code first."
      });
    }
    const { token } = await createSession({
      userId,
      email: cleanEmail,
      name: cleanName,
      role: userRole,
      isVerifiedSeller: false,
      mustChangePassword: false
    });
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD2,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      path: "/"
    });
    const signupShopName = txResult.sellerProfile?.shop_name || (shopName ? String(shopName).trim() : void 0);
    const signupCampus = txResult.sellerProfile?.campus || (campus ? String(campus).trim() : void 0);
    const signupArea = txResult.sellerProfile?.location_area || location?.area || void 0;
    await logAuditEvent({
      action: "USER_REGISTERED",
      actor: { id: userId, email: cleanEmail, role: userRole },
      target: { type: "user", id: userId },
      details: {
        name: cleanName,
        email: cleanEmail,
        role: userRole,
        age: parsedAge,
        isUnder18: parsedAge < 18,
        hasGuardianConsent: parsedAge < 18 ? Boolean(hasGuardianConsent) : true,
        guardianName: guardianName ? String(guardianName).trim() : null,
        shopName: signupShopName || null,
        campus: signupCampus || null,
        locationArea: signupArea || null,
        isVerifiedEmail
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    sendAdminAlert(
      `new_user_${userId}`,
      `New ${userRole === "seller" ? "Seller" : "Buyer"} Signed Up: ${cleanName}`,
      `Name: <strong>${escapeHtml(cleanName)}</strong><br/>
       Email: <strong>${escapeHtml(cleanEmail)}</strong><br/>
       Role: <strong>${escapeHtml(userRole.toUpperCase())}</strong><br/>
       Age: <strong>${parsedAge}</strong>${parsedAge < 18 && guardianName ? ` (Guardian: ${escapeHtml(guardianName)})` : ""}<br/>
       ${signupShopName ? `Shop: <strong>${escapeHtml(signupShopName)}</strong> (${escapeHtml(signupCampus || "Campus")})<br/>` : ""}
       Registered At: <strong>${(/* @__PURE__ */ new Date()).toISOString()}</strong>`
    ).catch(() => {
    });
    if (process.env.BREVO_API_KEY && !cleanEmail.endsWith(".local")) {
      const welcomeTpl = renderTransactionalEmail("welcome", {
        name: cleanName,
        role: userRole,
        appUrl: PRODUCTION_APP_URL
      });
      sendBrevoDirect(cleanEmail, welcomeTpl.subject, welcomeTpl.text, welcomeTpl.html, cleanName).catch(() => {
      });
    }
    return res.status(201).json({
      status: true,
      sessionToken: token,
      user: {
        id: txResult.savedUser.id,
        email: txResult.savedUser.email,
        name: txResult.savedUser.name,
        displayName: txResult.savedUser.display_name,
        profileSlug: txResult.savedUser.profile_slug,
        avatarUrl: txResult.savedUser.avatar_url || void 0,
        coverUrl: txResult.savedUser.cover_url || void 0,
        bio: txResult.savedUser.bio || "",
        campus: txResult.savedUser.campus || void 0,
        locationArea: txResult.savedUser.location_area || void 0,
        interests: Array.isArray(txResult.savedUser.interests) ? txResult.savedUser.interests : [],
        notificationPrefs: txResult.savedUser.notification_prefs || DEFAULT_NOTIFICATION_PREFS,
        privacySettings: txResult.savedUser.privacy_settings || initialPrivacy,
        role: txResult.savedUser.role,
        isVerifiedEmail: Boolean(txResult.savedUser.is_verified_email),
        age: txResult.savedUser.age,
        hasGuardianConsent: txResult.savedUser.has_guardian_consent,
        guardianName: txResult.savedUser.guardian_name,
        createdAt: txResult.savedUser.created_at,
        sellerProfile: txResult.sellerProfile
      },
      message: "Account successfully registered and saved to database."
    });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({
        status: false,
        message: "An account with this email address already exists. Please log in."
      });
    }
    console.error("[User Registration Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error saving user account. Please try again." });
  }
});
router4.post("/auth/login", async (req, res) => {
  try {
    const clientIp = req.ip || "unknown";
    const ipLimit = await checkAndRecordRateLimit(`login_ip:${clientIp}`, 30, 15 * 60 * 1e3);
    if (!ipLimit.allowed) {
      return res.status(429).json({
        status: false,
        error: "RATE_LIMITED",
        message: "Too many login attempts. Please wait a few minutes and try again."
      });
    }
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ status: false, message: "Email and password are required." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const lockout = await isAccountLocked(cleanEmail);
    if (lockout.locked) {
      return res.status(429).json({
        status: false,
        error: "ACCOUNT_LOCKED",
        message: `Account temporarily locked due to repeated failed logins. Please wait ${lockout.remainingSeconds} seconds.`,
        lockoutRemainingSeconds: lockout.remainingSeconds
      });
    }
    const userRes = await query(
      `SELECT u.*, s.id as seller_id, s.shop_name, s.verification_status, s.is_verified_seller, s.bio, s.campus
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE LOWER(u.email) = LOWER($1)`,
      [cleanEmail]
    );
    if (userRes.rows.length === 0) {
      await recordLoginFailure(cleanEmail);
      await logAuditEvent({
        action: "USER_LOGIN_FAILED",
        actor: { id: "unknown", email: cleanEmail, role: "visitor" },
        target: { type: "auth", id: cleanEmail },
        details: { reason: "unknown_email" },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      return res.status(401).json({
        status: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password."
      });
    }
    const userRow = userRes.rows[0];
    const isPasswordValid = verifyPassword(cleanPassword, userRow.password_hash);
    if (!isPasswordValid) {
      const fail = await recordLoginFailure(cleanEmail);
      await logAuditEvent({
        action: "USER_LOGIN_FAILED",
        actor: { id: userRow.id, email: userRow.email, role: userRow.role },
        target: { type: "auth", id: userRow.id },
        details: { reason: fail.locked ? "account_locked" : "invalid_password" },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      if (fail.locked) {
        return res.status(429).json({
          status: false,
          error: "ACCOUNT_LOCKED",
          message: "Too many failed login attempts. Account temporarily locked for 15 minutes."
        });
      }
      return res.status(401).json({
        status: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password."
      });
    }
    if (userRow.is_banned) {
      await logAuditEvent({
        action: "USER_LOGIN_FAILED",
        actor: { id: userRow.id, email: userRow.email, role: userRow.role },
        target: { type: "auth", id: userRow.id },
        details: { reason: "account_banned" },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      return res.status(403).json({
        status: false,
        error: "ACCOUNT_BANNED",
        message: userRow.ban_reason || "This account has been suspended by an administrator."
      });
    }
    await clearLoginFailures(cleanEmail);
    await query("UPDATE shopit_users SET last_login_at = NOW(), last_seen_at = NOW(), updated_at = NOW() WHERE id = $1", [userRow.id]);
    const { token } = await createSession({
      userId: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      subRole: userRow.role === "admin" && userRow.sub_role ? userRow.sub_role : void 0,
      sellerId: userRow.seller_id || void 0,
      isVerifiedSeller: Boolean(userRow.is_verified_seller),
      mustChangePassword: Boolean(userRow.must_change_password),
      tokenVersion: Number(userRow.token_version || 1)
    });
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD2,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      path: "/"
    });
    await logAuditEvent({
      action: "USER_LOGIN",
      actor: { id: userRow.id, email: userRow.email, role: userRow.role },
      target: { type: "session", id: token.slice(-8) },
      details: { role: userRow.role, mustChangePassword: userRow.must_change_password },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    const isMinor = userRow.age !== null && userRow.age !== void 0 && Number(userRow.age) < 18;
    const sanitizedUser = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      displayName: userRow.display_name || extractFirstName(userRow.name || "Member"),
      profileSlug: userRow.profile_slug || userRow.id,
      avatarUrl: userRow.avatar_url || void 0,
      coverUrl: userRow.cover_url || void 0,
      bio: userRow.bio || "",
      campus: userRow.campus || void 0,
      locationArea: userRow.location_area || void 0,
      interests: Array.isArray(userRow.interests) ? userRow.interests : [],
      notificationPrefs: sanitizeNotificationPrefs(userRow.notification_prefs, DEFAULT_NOTIFICATION_PREFS),
      privacySettings: sanitizePrivacySettings(
        userRow.privacy_settings,
        isMinor ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS,
        isMinor
      ),
      role: userRow.role,
      ...userRow.role === "admin" && userRow.sub_role ? { subRole: userRow.sub_role } : {},
      isVerifiedEmail: Boolean(userRow.is_verified_email),
      mustChangePassword: Boolean(userRow.must_change_password),
      age: userRow.age,
      hasGuardianConsent: Boolean(userRow.has_guardian_consent),
      guardianName: userRow.guardian_name,
      createdAt: userRow.created_at,
      lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (userRow.role === "seller" || userRow.seller_id) {
      sanitizedUser.sellerProfile = {
        id: userRow.seller_id || userRow.id,
        shopName: userRow.shop_name || `${sanitizedUser.displayName}'s Shop`,
        verificationStatus: userRow.verification_status || "not_started",
        isVerifiedSeller: Boolean(userRow.is_verified_seller),
        bio: userRow.bio || "",
        campus: userRow.campus || "Lagos Mainland"
      };
    }
    return res.json({
      status: true,
      sessionToken: token,
      user: sanitizedUser,
      mustChangePassword: Boolean(userRow.must_change_password),
      message: "Login successful."
    });
  } catch (err) {
    console.error("[User Login Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error processing login." });
  }
});
router4.post("/auth/logout", async (req, res) => {
  const token = extractToken(req);
  if (token) {
    const sess = await getSession(token);
    await destroySession(token);
    if (sess) {
      await logAuditEvent({
        action: "USER_LOGOUT",
        actor: { id: sess.userId, email: sess.email, role: sess.role },
        target: { type: "session", id: token.slice(-8) },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
    }
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  return res.json({ status: true, message: "Logged out successfully." });
});
router4.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 8) {
      return res.status(400).json({ status: false, message: "New password must be at least 8 characters long." });
    }
    const cleanNew = String(newPassword).trim();
    const userId = req.user.userId;
    const userRes = await query(
      "SELECT u.id, u.email, u.name, u.role, u.sub_role, s.id AS seller_id, s.is_verified_seller, u.password_hash, u.must_change_password FROM shopit_users u LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id) WHERE u.id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "User not found." });
    }
    const userRow = userRes.rows[0];
    if (!userRow.must_change_password) {
      if (!currentPassword || !verifyPassword(String(currentPassword).trim(), userRow.password_hash)) {
        return res.status(401).json({ status: false, message: "Current password is incorrect." });
      }
    }
    const newHash = hashPassword(cleanNew);
    await query(
      "UPDATE shopit_users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2",
      [newHash, userId]
    );
    await revokeUserSessions(userId);
    const { token } = await createSession({
      userId,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      subRole: req.user.subRole,
      sellerId: req.user.sellerId,
      isVerifiedSeller: req.user.isVerifiedSeller,
      mustChangePassword: false
    });
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD2,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      path: "/"
    });
    await logAuditEvent({
      action: "PASSWORD_CHANGED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id: userId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, sessionToken: token, message: "Password changed successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ status: false, message: "Email, 6-digit code, and new password are required." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim().replace(/\D/g, "");
    const cleanPassword = String(newPassword).trim();
    const rl = await checkAndRecordRateLimit(`reset_pw:${cleanEmail}`, 10, 15 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: "Too many reset attempts. Please try again later." });
    }
    if (cleanCode.length !== 6) {
      return res.status(400).json({ status: false, message: "Reset code must be a 6-digit number." });
    }
    if (cleanPassword.length < 8) {
      return res.status(400).json({ status: false, message: "New password must be at least 8 characters long." });
    }
    const otpResult = await verifyAndConsumeOtp(cleanEmail, "password_reset", cleanCode);
    if (!otpResult.success) {
      return res.status(400).json({
        status: false,
        message: otpResult.error || "Invalid or expired reset code.",
        attemptsRemaining: otpResult.attemptsRemaining
      });
    }
    const userCheck = await query("SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1)", [cleanEmail]);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ status: false, message: "Unable to reset password for this account." });
    }
    const userId = userCheck.rows[0].id;
    const newHash = hashPassword(cleanPassword);
    await query("UPDATE shopit_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, userId]);
    await revokeUserSessions(userId);
    await logAuditEvent({
      action: "PASSWORD_RESET_COMPLETED",
      actor: { id: userId, email: cleanEmail, role: "user" },
      target: { type: "user", id: userId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      message: "Your password has been reset successfully! All older sessions were signed out."
    });
  } catch (err) {
    console.error("[Password Reset Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error updating password." });
  }
});
router4.post("/auth/change-email/request-otp", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["newEmail", "currentPassword"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { newEmail, currentPassword } = check.obj;
    const cleanNewEmail = String(newEmail || "").trim().toLowerCase();
    if (!cleanNewEmail || cleanNewEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
      return res.status(400).json({ status: false, message: "Please provide a valid email address." });
    }
    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({ status: false, message: "Your current password is required to change your email." });
    }
    const userId = req.user.userId;
    const uRes = await query("SELECT id, email, password_hash FROM shopit_users WHERE id = $1", [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "User account not found." });
    }
    const uRow = uRes.rows[0];
    if (String(uRow.email).trim().toLowerCase() === cleanNewEmail) {
      return res.status(400).json({ status: false, message: "Please enter a different email address from your current one." });
    }
    if (!verifyPassword(currentPassword.trim(), uRow.password_hash)) {
      return res.status(401).json({ status: false, message: "Current password is incorrect." });
    }
    const conflictRes = await query("SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1", [
      cleanNewEmail,
      userId
    ]);
    if (conflictRes.rows.length > 0) {
      return res.status(409).json({ status: false, message: "That email address is already registered to another account." });
    }
    const rl = await checkAndRecordRateLimit(`email_change_req:${userId}`, 5, 15 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: "Too many email change requests. Please wait a few minutes." });
    }
    const code = String(crypto12.randomInt(1e5, 1e6));
    const codeHash = hashOtp(code);
    await saveHashedOtp(cleanNewEmail, "email_change", codeHash, { userId, oldEmail: uRow.email });
    const rendered = renderTransactionalEmail("email_change", { code, email: cleanNewEmail });
    const emailSent = await sendBrevoDirect(cleanNewEmail, rendered.subject, rendered.text, rendered.html);
    if (IS_PROD2 && !emailSent) {
      await deleteOtpRecord(cleanNewEmail, "email_change").catch(() => {
      });
      return res.status(503).json({ status: false, message: "Email service temporarily unavailable. Please try again." });
    }
    await logAuditEvent({
      action: "EMAIL_CHANGE_OTP_REQUESTED",
      actor: { id: userId, email: uRow.email, role: req.user.role },
      target: { type: "user", id: userId },
      details: { requestedNewEmailDomain: cleanNewEmail.split("@")[1] || "" },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: `A 6-digit confirmation code was sent to ${cleanNewEmail}.` });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Unable to send email confirmation code." });
  }
});
router4.post("/auth/change-email/confirm", requireAuth, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["newEmail", "code", "currentPassword"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { newEmail, code, currentPassword } = check.obj;
    const cleanNewEmail = String(newEmail || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim().replace(/\D/g, "");
    if (!cleanNewEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail) || cleanCode.length !== 6) {
      return res.status(400).json({ status: false, message: "Valid new email and 6-digit verification code are required." });
    }
    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({ status: false, message: "Current password is required." });
    }
    const userId = req.user.userId;
    const uRes = await query("SELECT id, email, name, role, sub_role, password_hash FROM shopit_users WHERE id = $1", [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "User not found." });
    }
    const uRow = uRes.rows[0];
    if (!verifyPassword(currentPassword.trim(), uRow.password_hash)) {
      return res.status(401).json({ status: false, message: "Current password is incorrect." });
    }
    const otpRes = await verifyAndConsumeOtp(cleanNewEmail, "email_change", cleanCode);
    if (!otpRes.success) {
      return res.status(400).json({
        status: false,
        message: otpRes.error || "Invalid or expired verification code.",
        attemptsRemaining: otpRes.attemptsRemaining
      });
    }
    if (otpRes.record?.metadata?.userId && otpRes.record.metadata.userId !== userId) {
      return res.status(403).json({ status: false, message: "Verification code does not belong to your account." });
    }
    const txRes = await withTransaction(async (client) => {
      const conflict = await client.query("SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1", [
        cleanNewEmail,
        userId
      ]);
      if (conflict.rows.length > 0) {
        return { conflict: true };
      }
      await client.query("UPDATE shopit_users SET email = $1, is_verified_email = true, updated_at = NOW() WHERE id = $2", [
        cleanNewEmail,
        userId
      ]);
      await client.query("UPDATE shopit_sellers SET email = $1, updated_at = NOW() WHERE user_id = $2 OR id = $2", [
        cleanNewEmail,
        userId
      ]);
      return { conflict: false };
    });
    if (txRes.conflict) {
      return res.status(409).json({ status: false, message: "That email address is already in use." });
    }
    await revokeUserSessions(userId);
    const { token } = await createSession({
      userId,
      email: cleanNewEmail,
      name: uRow.name,
      role: uRow.role,
      subRole: uRow.role === "admin" ? uRow.sub_role : void 0,
      sellerId: req.user.sellerId,
      isVerifiedSeller: req.user.isVerifiedSeller
    });
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD2,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      path: "/"
    });
    await logAuditEvent({
      action: "EMAIL_CHANGED",
      actor: { id: userId, email: cleanNewEmail, role: uRow.role },
      target: { type: "user", id: userId },
      details: { previousEmailDomain: String(uRow.email).split("@")[1] || "", newEmailDomain: cleanNewEmail.split("@")[1] || "" },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      email: cleanNewEmail,
      sessionToken: token,
      message: "Your email address has been updated and older sessions signed out."
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to confirm email change." });
  }
});
function parseJsonField(val, fallback) {
  if (val === null || val === void 0) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val;
}
__name(parseJsonField, "parseJsonField");
async function loadHydratedUserProfile(userId) {
  const result = await query(
    `SELECT u.id, u.email, u.name, u.display_name, u.profile_slug, u.tagline, u.avatar_url, u.cover_url, u.bio,
            u.location_state, u.campus, u.location_area, u.interests, u.languages, u.notification_prefs, u.privacy_settings, u.last_seen_at,
            u.role, u.sub_role, u.is_verified_email, u.must_change_password, u.is_banned, u.ban_reason,
            u.age, u.has_guardian_consent, u.guardian_name, u.created_at, u.last_login_at, u.deleted_at,
            s.id as seller_id, s.shop_name, s.bio as s_bio, s.shop_story, s.craft_materials, s.processing_time, s.delivery_options,
            s.location_state as s_location_state, s.campus as s_campus, s.location_area as s_area,
            s.vacation_mode, s.logo_url as s_logo_url, s.banner_url as s_banner_url, s.is_verified_seller as seller_is_verified,
            s.verification_status as seller_verification_status,
            s.verified_legal_name, s.verified_nin_last4, s.verified_at
     FROM shopit_users u
     LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  const isVerified = Boolean(
    row.seller_is_verified || row.seller_verification_status === "verified" || row.seller_verification_status === "approved"
  );
  const currentStatus = isVerified ? "verified" : row.seller_verification_status || "not_started";
  const isMinor = row.age !== null && row.age !== void 0 && Number(row.age) < 18;
  const displayName = row.display_name || extractFirstName(row.name || "Member");
  const parsedInterests = parseJsonField(row.interests, []);
  const parsedLanguages = parseJsonField(row.languages, []);
  const parsedDeliveryOptions = parseJsonField(row.delivery_options, { allowsPickup: true, allowsLocalDelivery: true, pickupSpots: [] });
  const sanitizedUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    displayName,
    profileSlug: row.profile_slug || row.id,
    tagline: row.tagline || "",
    avatarUrl: row.avatar_url || row.s_logo_url || void 0,
    coverUrl: row.cover_url || row.s_banner_url || void 0,
    bio: row.bio || row.s_bio || "",
    locationState: row.location_state || row.s_location_state || void 0,
    campus: row.campus || row.s_campus || void 0,
    locationArea: row.location_area || row.s_area || void 0,
    interests: Array.isArray(parsedInterests) ? parsedInterests : [],
    languages: Array.isArray(parsedLanguages) ? parsedLanguages : [],
    notificationPrefs: sanitizeNotificationPrefs(row.notification_prefs, DEFAULT_NOTIFICATION_PREFS),
    privacySettings: sanitizePrivacySettings(
      row.privacy_settings,
      isMinor ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS,
      isMinor
    ),
    lastSeenAt: row.last_seen_at || row.last_login_at || row.created_at,
    role: row.role,
    subRole: row.role === "admin" ? row.sub_role || void 0 : void 0,
    isVerifiedEmail: Boolean(row.is_verified_email),
    mustChangePassword: Boolean(row.must_change_password),
    isVerifiedSeller: isVerified,
    verificationStatus: currentStatus,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason,
    age: row.age,
    hasGuardianConsent: Boolean(row.has_guardian_consent),
    guardianName: row.guardian_name,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
  if (row.role === "seller" || row.seller_id) {
    sanitizedUser.sellerProfile = {
      id: row.seller_id || row.id,
      shopName: row.shop_name || `${displayName}'s Shop`,
      ownerName: displayName,
      verificationStatus: currentStatus,
      isVerifiedSeller: isVerified,
      bio: row.s_bio || row.bio || "",
      shopStory: row.shop_story || "",
      craftMaterials: row.craft_materials || "",
      processingTime: row.processing_time || "",
      deliveryOptions: {
        allowsPickup: parsedDeliveryOptions?.allowsPickup !== false,
        allowsLocalDelivery: parsedDeliveryOptions?.allowsLocalDelivery !== false,
        pickupSpots: Array.isArray(parsedDeliveryOptions?.pickupSpots) ? parsedDeliveryOptions.pickupSpots : []
      },
      locationState: row.s_location_state || row.location_state || "Lagos",
      campus: row.s_campus || row.campus || "Lagos Mainland",
      locationArea: row.s_area || row.location_area || "Yaba",
      vacationMode: Boolean(row.vacation_mode),
      logoUrl: row.s_logo_url || row.avatar_url || void 0,
      bannerUrl: row.s_banner_url || row.cover_url || void 0,
      verifiedLegalName: row.verified_legal_name,
      verifiedNinLast4: row.verified_nin_last4,
      verifiedAt: row.verified_at,
      badges: isVerified ? ["verified"] : []
    };
  }
  return {
    sanitizedUser,
    isVerifiedSeller: isVerified,
    verificationStatus: currentStatus
  };
}
__name(loadHydratedUserProfile, "loadHydratedUserProfile");
router4.get("/auth/session", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.json({ status: true, authenticated: false, user: null });
    }
    const hydrated = await loadHydratedUserProfile(req.user.userId);
    if (!hydrated) {
      return res.json({ status: true, authenticated: false, user: null });
    }
    await query("UPDATE shopit_users SET last_seen_at = NOW() WHERE id = $1", [req.user.userId]).catch(() => {
    });
    return res.json({
      status: true,
      authenticated: true,
      user: hydrated.sanitizedUser,
      isVerifiedSeller: hydrated.isVerifiedSeller,
      verificationStatus: hydrated.verificationStatus
    });
  } catch (err) {
    console.error("[Auth Session Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error checking session." });
  }
});
router4.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const sessionUser = req.user;
    const hydrated = await loadHydratedUserProfile(sessionUser.userId);
    if (!hydrated) {
      return res.status(404).json({ status: false, message: "User not found." });
    }
    await query("UPDATE shopit_users SET last_seen_at = NOW() WHERE id = $1", [sessionUser.userId]).catch(() => {
    });
    return res.json({
      status: true,
      user: hydrated.sanitizedUser,
      isVerifiedSeller: hydrated.isVerifiedSeller,
      verificationStatus: hydrated.verificationStatus
    });
  } catch (err) {
    console.error("[Auth Me Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error fetching profile." });
  }
});
router4.get("/admin/users", requireModerator, async (req, res) => {
  try {
    const rawQ = req.query.q ? String(req.query.q).trim().toLowerCase() : "";
    const q = rawQ.slice(0, 100);
    const role = req.query.role ? String(req.query.role).trim().toLowerCase() : "all";
    if (!["all", "buyer", "seller", "admin"].includes(role)) {
      return res.status(400).json({ status: false, message: "Invalid role filter. Must be all, buyer, seller, or admin." });
    }
    const onlyNew = String(req.query.onlyNew || "").toLowerCase() === "true" || req.query.onlyNew === "1";
    const rawPage = req.query.page !== void 0 ? String(req.query.page).trim() : "1";
    const rawLimit = req.query.limit !== void 0 ? String(req.query.limit).trim() : "15";
    const parsedPage = /^\d+$/.test(rawPage) ? parseInt(rawPage, 10) : NaN;
    const parsedLimit = /^\d+$/.test(rawLimit) ? parseInt(rawLimit, 10) : NaN;
    if (isNaN(parsedPage) || parsedPage < 1 || isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ status: false, message: "Invalid pagination parameters: page and limit must be positive integers." });
    }
    const page = parsedPage;
    const limit = Math.min(200, parsedLimit);
    const offset = (page - 1) * limit;
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setHours(0, 0, 0, 0);
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (q) {
      conditions.push(`(LOWER(u.name) LIKE $${paramIndex} OR LOWER(COALESCE(u.display_name, '')) LIKE $${paramIndex} OR LOWER(u.email) LIKE $${paramIndex} OR LOWER(COALESCE(u.profile_slug, '')) LIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (role && role !== "all") {
      conditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    if (onlyNew) {
      conditions.push(`u.created_at >= $${paramIndex}`);
      params.push(cutoff24h);
      paramIndex++;
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [countRes, newCountsRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM shopit_users u ${whereClause}`, params),
      query(
        `SELECT
           COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_today,
           COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_24h
         FROM shopit_users`,
        [todayStart.toISOString(), cutoff24h]
      )
    ]);
    const total = parseInt(countRes.rows[0].total, 10);
    const dataSql = `
      SELECT u.id, u.email, u.name, u.display_name, u.profile_slug, u.avatar_url, u.bio, u.interests,
             u.campus as u_campus, u.location_area as u_area, u.deleted_at,
             u.role, u.sub_role, u.is_verified_email, u.age, u.has_guardian_consent,
             u.guardian_name, u.is_banned, u.ban_reason, u.last_login_at, u.created_at,
             s.id as seller_id, s.shop_name, s.campus, s.location_area, s.bio as s_bio,
             s.verification_status, s.is_verified_seller
      FROM shopit_users u
      LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const usersRes = await query(dataSql, [...params, limit, offset]);
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1e3;
    const seenUserIds = /* @__PURE__ */ new Set();
    const users = usersRes.rows.filter((row) => {
      if (seenUserIds.has(row.id)) return false;
      seenUserIds.add(row.id);
      return true;
    }).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      displayName: row.display_name || extractFirstName(row.name || "Member"),
      profileSlug: row.profile_slug || row.id,
      avatarUrl: row.avatar_url || void 0,
      role: row.role,
      ...row.role === "admin" && row.sub_role ? { subRole: row.sub_role } : {},
      isVerifiedEmail: Boolean(row.is_verified_email),
      age: row.age,
      hasGuardianConsent: Boolean(row.has_guardian_consent),
      guardianName: row.guardian_name,
      isBanned: Boolean(row.is_banned),
      banReason: row.ban_reason,
      deletedAt: row.deleted_at || void 0,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      isNew: row.created_at ? new Date(row.created_at).getTime() >= cutoffMs : false,
      shopName: row.shop_name,
      campus: row.campus || row.u_campus,
      locationArea: row.location_area || row.u_area,
      bio: row.bio || row.s_bio,
      interests: Array.isArray(row.interests) ? row.interests : [],
      verificationStatus: row.verification_status || (row.role === "seller" ? "not_started" : "not_applicable"),
      isVerifiedSeller: Boolean(row.is_verified_seller)
    }));
    return res.json({
      status: true,
      users,
      total,
      newTodayCount: parseInt(newCountsRes.rows[0]?.new_today || "0", 10),
      newLast24HoursCount: parseInt(newCountsRes.rows[0]?.new_24h || "0", 10),
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("[Admin Users Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error reading users." });
  }
});
router4.patch("/admin/users/:id/moderate-profile", requireModerator, async (req, res) => {
  try {
    const check = rejectUnknownFields(req.body, ["action", "reason"]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const action = String(check.obj.action || "").trim();
    const reason = String(check.obj.reason || "Policy compliance review").trim().slice(0, 240);
    if (!["remove_avatar", "remove_cover", "clear_bio", "reset_display_name"].includes(action)) {
      return res.status(400).json({
        status: false,
        message: "action must be one of remove_avatar, remove_cover, clear_bio, or reset_display_name."
      });
    }
    const targetId = String(req.params.id || "").trim();
    const uRes = await query(
      "SELECT id, name, display_name, deleted_at FROM shopit_users WHERE id = $1 LIMIT 1",
      [targetId]
    );
    if (uRes.rows.length === 0 || uRes.rows[0].deleted_at) {
      return res.status(404).json({ status: false, message: "User not found." });
    }
    const uRow = uRes.rows[0];
    let updatedDisplayName;
    await withTransaction(async (client) => {
      if (action === "remove_avatar") {
        await client.query("UPDATE shopit_users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1", [targetId]);
        await client.query("UPDATE shopit_sellers SET logo_url = NULL, updated_at = NOW() WHERE user_id = $1 OR id = $1", [targetId]);
      } else if (action === "remove_cover") {
        await client.query("UPDATE shopit_users SET cover_url = NULL, updated_at = NOW() WHERE id = $1", [targetId]);
        await client.query("UPDATE shopit_sellers SET banner_url = NULL, updated_at = NOW() WHERE user_id = $1 OR id = $1", [targetId]);
      } else if (action === "clear_bio") {
        await client.query("UPDATE shopit_users SET bio = NULL, updated_at = NOW() WHERE id = $1", [targetId]);
        await client.query("UPDATE shopit_sellers SET bio = '', updated_at = NOW() WHERE user_id = $1 OR id = $1", [targetId]);
      } else if (action === "reset_display_name") {
        updatedDisplayName = extractFirstName(uRow.name || "Member");
        await client.query("UPDATE shopit_users SET display_name = $1, updated_at = NOW() WHERE id = $2", [
          updatedDisplayName,
          targetId
        ]);
      }
      await client.query(
        `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
         VALUES ($1, $2, 'Profile Moderated', $3, 'warning', false, '/profile', NOW())`,
        [
          `notif_modprof_${Date.now()}_${crypto12.randomBytes(3).toString("hex")}`,
          targetId,
          `A moderator updated your profile (${action.replace("_", " ")}): ${reason}`
        ]
      );
    });
    await logAuditEvent({
      action: "ADMIN_PROFILE_MODERATED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id: targetId },
      details: { action, reason },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      action,
      updatedDisplayName,
      message: `Profile moderation action (${action}) applied.`
    });
  } catch (err) {
    console.error("[Moderate Profile Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to moderate user profile." });
  }
});
router4.get("/admin/reported-chats", requireModerator, async (req, res) => {
  try {
    const reportsRes = await query(
      `SELECT id, target_id, target_title, reason, details, status, created_at
       FROM shopit_reports
       WHERE target_type = 'chat'
       ORDER BY created_at DESC
       LIMIT 100`
    );
    const reportedChats = [];
    for (const rep of reportsRes.rows) {
      const convRes = await query(
        `SELECT id, buyer_id, buyer_masked_id, seller_id, seller_shop_name, product_id, product_title,
                is_chat_locked, bypass_violations_count, last_message_at
         FROM shopit_chat_conversations
         WHERE id = $1
         LIMIT 1`,
        [rep.target_id]
      );
      const conv = convRes.rows[0] || null;
      const msgRes = await query(
        `SELECT id, sender_id, sender_role, sender_masked_name, content, attachment, is_blocked_bypass, created_at
         FROM shopit_chat_messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT 30`,
        [rep.target_id]
      );
      const userIds = Array.from(
        new Set(
          [conv?.buyer_id, ...msgRes.rows.map((m) => m.sender_id)].filter(Boolean).map(String)
        )
      );
      const nameMap = /* @__PURE__ */ new Map();
      if (userIds.length > 0) {
        const placeholders = userIds.map((_, idx) => `$${idx + 1}`).join(", ");
        const uRes = await query(
          `SELECT id, name, display_name FROM shopit_users WHERE id IN (${placeholders})`,
          userIds
        );
        for (const u of uRes.rows) {
          const first = String(u.name || "").trim().split(/\s+/)[0] || "";
          const resolved = String(u.display_name || first || "").trim();
          if (resolved) nameMap.set(String(u.id), resolved);
        }
      }
      reportedChats.push({
        reportId: rep.id,
        reportStatus: rep.status,
        reason: rep.reason,
        details: rep.details || "",
        reportedAt: rep.created_at,
        conversationId: rep.target_id,
        conversation: conv ? {
          id: conv.id,
          buyerName: conv.buyer_id && nameMap.get(String(conv.buyer_id)) || conv.buyer_masked_id || "Buyer",
          sellerShopName: conv.seller_shop_name || "Seller",
          productTitle: conv.product_title || "",
          isChatLocked: Boolean(conv.is_chat_locked),
          violationsCount: Number(conv.bypass_violations_count || 0),
          lastMessageAt: conv.last_message_at
        } : null,
        messages: msgRes.rows.slice().reverse().map((m) => {
          const parsedAtt = typeof m.attachment === "string" ? (() => {
            try {
              return JSON.parse(m.attachment);
            } catch {
              return void 0;
            }
          })() : m.attachment || void 0;
          const resolvedSender = m.sender_id && nameMap.get(String(m.sender_id)) || m.sender_masked_name || m.sender_role;
          return {
            id: m.id,
            senderRole: m.sender_role,
            senderDisplayName: resolvedSender,
            content: m.content || "",
            attachment: parsedAtt,
            isBlockedBypass: Boolean(m.is_blocked_bypass),
            createdAt: m.created_at
          };
        })
      });
    }
    await logAuditEvent({
      action: "ADMIN_VIEWED_REPORTED_CHATS",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "chat_reports", id: "list" },
      details: { count: reportedChats.length },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, reportedChats });
  } catch (err) {
    console.error("[Reported Chats Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to load reported chats." });
  }
});
router4.get("/admin/new-users", requireModerator, async (req, res) => {
  try {
    const rawPage = req.query.page !== void 0 ? String(req.query.page).trim() : "1";
    const rawLimit = req.query.limit !== void 0 ? String(req.query.limit).trim() : "20";
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20));
    const offset = (page - 1) * limit;
    const unreadOnly = String(req.query.unreadOnly || "").toLowerCase() === "true";
    const whereExtra = unreadOnly ? "AND COALESCE(a.is_read, false) = false" : "";
    const [countRes, unreadRes, rowsRes] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total
         FROM shopit_users u
         LEFT JOIN shopit_admin_alerts a ON a.user_id = u.id AND (a.alert_type = 'new_user' OR a.alert_key LIKE 'new_user_%')
         WHERE u.deleted_at IS NULL ${whereExtra}`
      ),
      query(
        `SELECT COUNT(*) AS unread
         FROM shopit_admin_alerts
         WHERE (alert_type = 'new_user' OR alert_key LIKE 'new_user_%') AND COALESCE(is_read, false) = false`
      ),
      query(
        `SELECT u.id AS user_id, u.email, u.name, u.display_name, u.profile_slug, u.role,
                u.age, u.has_guardian_consent, u.guardian_name, u.is_verified_email, u.created_at AS user_created_at,
                s.shop_name, s.campus, s.location_area, s.verification_status, s.is_verified_seller,
                a.id AS alert_id, a.alert_key, a.title, a.message, COALESCE(a.is_read, false) AS is_read, a.created_at AS alert_created_at
         FROM shopit_users u
         LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
         LEFT JOIN shopit_admin_alerts a ON a.user_id = u.id AND (a.alert_type = 'new_user' OR a.alert_key LIKE 'new_user_%')
         WHERE u.deleted_at IS NULL ${whereExtra}
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
    ]);
    const seen = /* @__PURE__ */ new Set();
    const items = rowsRes.rows.filter((row) => {
      if (seen.has(row.user_id)) return false;
      seen.add(row.user_id);
      return true;
    }).map((row) => ({
      alertId: row.alert_id || row.alert_key || `new_user_${row.user_id}`,
      alertKey: row.alert_key || `new_user_${row.user_id}`,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      displayName: row.display_name || extractFirstName(row.name || "Member"),
      profileSlug: row.profile_slug || row.user_id,
      role: row.role,
      age: row.age,
      hasGuardianConsent: Boolean(row.has_guardian_consent),
      guardianName: row.guardian_name,
      isVerifiedEmail: Boolean(row.is_verified_email),
      shopName: row.shop_name || void 0,
      campus: row.campus || void 0,
      locationArea: row.location_area || void 0,
      verificationStatus: row.verification_status || (row.role === "seller" ? "not_started" : "not_applicable"),
      isVerifiedSeller: Boolean(row.is_verified_seller),
      title: row.title || `New ${row.role === "seller" ? "Seller" : row.role === "admin" ? "Admin" : "Buyer"} Registered: ${row.name}`,
      message: row.message || `${row.name} (${row.email}) registered as ${row.role}.`,
      isRead: Boolean(row.is_read),
      createdAt: row.user_created_at || row.alert_created_at
    }));
    const total = parseInt(String(countRes.rows[0]?.total || "0"), 10);
    const unreadCount = parseInt(String(unreadRes.rows[0]?.unread || "0"), 10);
    return res.json({
      status: true,
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("[Admin New Users Feed Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error loading new users feed." });
  }
});
router4.patch("/admin/alerts/:id/read", requireModerator, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "all") {
      await query(
        `UPDATE shopit_admin_alerts SET is_read = true WHERE (alert_type = 'new_user' OR alert_key LIKE 'new_user_%') AND COALESCE(is_read, false) = false`
      );
      return res.json({ status: true, message: "All new user alerts marked as read." });
    }
    await query(
      `UPDATE shopit_admin_alerts SET is_read = true WHERE id = $1 OR alert_key = $1 OR user_id = $1`,
      [id]
    );
    return res.json({ status: true, message: "Alert marked as read." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to update alert read state." });
  }
});
router4.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.userId) {
      return res.status(400).json({ status: false, message: "Administrators cannot delete their own account." });
    }
    await revokeUserSessions(id);
    await query("DELETE FROM shopit_users WHERE id = $1", [id]);
    await logAuditEvent({
      action: "ADMIN_USER_DELETED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "User deleted from database." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.post("/admin/users/:id/ban", requireModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, banReason } = req.body;
    await query(
      "UPDATE shopit_users SET is_banned = $1, ban_reason = $2, updated_at = NOW() WHERE id = $3",
      [Boolean(isBanned), banReason || null, id]
    );
    if (Boolean(isBanned)) {
      await revokeUserSessions(id);
    }
    await logAuditEvent({
      action: isBanned ? "ADMIN_USER_BANNED" : "ADMIN_USER_UNBANNED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id },
      details: { banReason },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: `User ban status updated to ${Boolean(isBanned)}.` });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.post("/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 8) {
      return res.status(400).json({ status: false, message: "New password must be at least 8 characters." });
    }
    const hash = hashPassword(String(newPassword).trim());
    await query("UPDATE shopit_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, id]);
    await revokeUserSessions(id);
    await logAuditEvent({
      action: "ADMIN_PASSWORD_RESET",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "user", id },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "User password updated and active sessions revoked." });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.post("/admin/sellers/:id/verify", requireModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;
    const status = isVerified ? "verified" : "rejected";
    await withTransaction(async (client) => {
      const updateRes = await client.query(
        `UPDATE shopit_sellers
         SET is_verified_seller = $1,
             verification_status = $2,
             verified_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $3 OR user_id = $3 OR LOWER(email) = LOWER($3)`,
        [Boolean(isVerified), status, id]
      );
      if (updateRes.rowCount === 0) {
        await client.query(
          `INSERT INTO shopit_sellers (
             id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status, verified_at, created_at, updated_at
           )
           SELECT u.id, u.id, COALESCE(u.name || '''s Shop', 'Artisan Shop'), u.name, u.email, $1, $2, CASE WHEN $1 = true THEN NOW() ELSE NULL END, NOW(), NOW()
           FROM shopit_users u
           WHERE u.id = $3 OR LOWER(u.email) = LOWER($3)
           ON CONFLICT (id) DO UPDATE SET is_verified_seller = $1, verification_status = $2, updated_at = NOW()`,
          [Boolean(isVerified), status, id]
        );
      }
      await client.query(
        `UPDATE shopit_users
         SET role = CASE WHEN $1 = true AND role = 'buyer' THEN 'seller' ELSE role END,
             updated_at = NOW()
         WHERE id = $2 OR LOWER(email) = LOWER($2) OR id IN (SELECT user_id FROM shopit_sellers WHERE id = $2)`,
        [Boolean(isVerified), id]
      );
      await client.query(
        `UPDATE shopit_verifications
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
             document_url = '[Deleted after review decision]',
             selfie_url = '[Deleted after review decision]',
             updated_at = NOW()
         WHERE seller_id = $3 OR user_id = $3 OR id = $3`,
        [status, req.user.email, id]
      );
      await client.query(
        `DELETE FROM shopit_verification_documents
         WHERE seller_id = $1
            OR seller_id IN (SELECT id FROM shopit_sellers WHERE id = $1 OR user_id = $1)`,
        [id]
      );
    });
    await logAuditEvent({
      action: isVerified ? "ADMIN_SELLER_VERIFIED" : "ADMIN_SELLER_REJECTED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "seller", id },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      isVerifiedSeller: Boolean(isVerified),
      verificationStatus: status,
      message: `Seller verification updated to ${Boolean(isVerified)}.`
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.get("/admin/payout-accounts/pending", requireAdmin, async (_req, res) => {
  try {
    const wRes = await query(
      `SELECT w.seller_id, w.payout_accounts, s.shop_name, s.owner_name, s.guardian_name, s.under_18, u.age
       FROM shopit_wallets w
       LEFT JOIN shopit_sellers s ON (s.id = w.seller_id OR s.user_id = w.seller_id)
       LEFT JOIN shopit_users u ON u.id = s.user_id`
    );
    const pendingApprovals = [];
    for (const row of wRes.rows) {
      const accounts = Array.isArray(row.payout_accounts) ? row.payout_accounts : [];
      for (const acc of accounts) {
        if (acc && acc.adminApproved === false) {
          pendingApprovals.push({
            sellerId: row.seller_id,
            shopName: row.shop_name || "Artisan Shop",
            ownerName: row.owner_name || "Seller",
            guardianName: row.guardian_name || acc.guardianName || "",
            sellerAge: row.age ?? null,
            accountId: acc.id,
            bankName: acc.bankName,
            accountNumber: acc.accountNumber,
            accountName: acc.accountName,
            createdAt: acc.createdAt
          });
        }
      }
    }
    return res.json({ status: true, pendingApprovals });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.post("/admin/wallets/:sellerId/payout-accounts/:accountId/approve", requireAdmin, async (req, res) => {
  try {
    const { sellerId, accountId } = req.params;
    const wRes = await query("SELECT seller_id, payout_accounts FROM shopit_wallets WHERE seller_id = $1", [sellerId]);
    if (wRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Seller wallet not found." });
    }
    const accounts = Array.isArray(wRes.rows[0].payout_accounts) ? wRes.rows[0].payout_accounts : [];
    const targetAcc = accounts.find((a) => a.id === accountId);
    if (!targetAcc) {
      return res.status(404).json({ status: false, message: "Payout account not found." });
    }
    const updated = accounts.map(
      (a) => a.id === accountId ? {
        ...a,
        adminApproved: true,
        adminApprovedBy: req.user.email,
        adminApprovedAt: (/* @__PURE__ */ new Date()).toISOString()
      } : a
    );
    await query("UPDATE shopit_wallets SET payout_accounts = $1, updated_at = NOW() WHERE seller_id = $2", [
      JSON.stringify(updated),
      sellerId
    ]);
    await logAuditEvent({
      action: "MINOR_PAYOUT_ACCOUNT_APPROVED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "wallet", id: sellerId },
      details: { accountId, accountName: targetAcc.accountName, last4: String(targetAcc.accountNumber || "").slice(-4) },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      message: "Guardian payout account approved for withdrawals.",
      account: updated.find((a) => a.id === accountId)
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.patch("/admin/orders/:orderId/hold", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const hold = Boolean(req.body?.hold);
    const upd = await query(
      "UPDATE shopit_orders SET admin_hold = $1, updated_at = NOW() WHERE id = $2 RETURNING id, admin_hold",
      [hold, orderId]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Order not found." });
    }
    await logAuditEvent({
      action: "ORDER_ADMIN_HOLD_UPDATED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "order", id: orderId },
      details: { adminHold: hold },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, orderId, adminHold: Boolean(upd.rows[0].admin_hold) });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.all("/admin/users/wipe-non-admins", requireAdmin, (_req, res) => {
  return res.status(410).json({
    status: false,
    error: "ENDPOINT_DISABLED",
    message: "This destructive endpoint has been permanently disabled for safety and security."
  });
});
router4.get("/admin/metrics", requireModerator, async (_req, res) => {
  try {
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setHours(0, 0, 0, 0);
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    const [userStats, sellerStats, verifStats, activityStats, orderStats, productStats, latestUsersRes] = await Promise.all([
      query(
        `SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_today,
          COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_24h,
          COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
          COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers,
          COUNT(CASE WHEN is_banned = true THEN 1 END) as suspended_users
        FROM shopit_users`,
        [todayStart.toISOString(), cutoff24h]
      ),
      query(`SELECT COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_sellers FROM shopit_sellers`),
      query(`SELECT COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_verifications FROM shopit_verifications`),
      query(
        `SELECT
          COUNT(*) as total_events,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as events_24h
         FROM shopit_audit_logs`,
        [cutoff24h]
      ),
      query(`SELECT COUNT(*) as total_orders FROM shopit_orders`),
      query(`SELECT COUNT(*) as total_products FROM shopit_products`),
      query(
        `SELECT u.id, u.email, u.name, u.role, u.age, u.has_guardian_consent, u.guardian_name, u.is_verified_email, u.is_banned, u.created_at, u.last_login_at,
                s.shop_name, s.campus, s.location_area, s.verification_status, s.is_verified_seller
         FROM shopit_users u
         LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
         ORDER BY u.created_at DESC
         LIMIT 10`
      )
    ]);
    const [pgPing, redisPing, dbStats] = await Promise.all([
      pingPostgres(),
      pingRedis(),
      getDatabaseHealthStats()
    ]);
    await checkStorageThresholdAlert(dbStats.databaseSizeMb);
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1e3;
    return res.json({
      status: true,
      metrics: {
        totalUsers: parseInt(userStats.rows[0].total_users || "0", 10),
        newToday: parseInt(userStats.rows[0].new_today || "0", 10),
        newLast24Hours: parseInt(userStats.rows[0].new_24h || "0", 10),
        totalSellers: parseInt(userStats.rows[0].total_sellers || "0", 10),
        totalBuyers: parseInt(userStats.rows[0].total_buyers || "0", 10),
        suspendedUsers: parseInt(userStats.rows[0].suspended_users || "0", 10),
        verifiedSellers: parseInt(sellerStats.rows[0].verified_sellers || "0", 10),
        pendingVerifications: parseInt(verifStats.rows[0].pending_verifications || "0", 10),
        totalActivityEvents: parseInt(activityStats.rows[0].total_events || "0", 10),
        activityLast24Hours: parseInt(activityStats.rows[0].events_24h || "0", 10),
        totalOrders: parseInt(orderStats.rows[0].total_orders || "0", 10),
        totalProducts: parseInt(productStats.rows[0].total_products || "0", 10)
      },
      latestUsers: latestUsersRes.rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        age: row.age,
        hasGuardianConsent: Boolean(row.has_guardian_consent),
        guardianName: row.guardian_name,
        isVerifiedEmail: Boolean(row.is_verified_email),
        isBanned: Boolean(row.is_banned),
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        isNew: row.created_at ? new Date(row.created_at).getTime() >= cutoffMs : false,
        shopName: row.shop_name,
        campus: row.campus,
        locationArea: row.location_area,
        verificationStatus: row.verification_status || (row.role === "seller" ? "not_started" : "not_applicable"),
        isVerifiedSeller: Boolean(row.is_verified_seller)
      })),
      database: {
        neon: pgPing.ok && !pgPing.isPgMem,
        isPgMem: Boolean(pgPing.isPgMem),
        redis: redisPing.ok,
        provider: pgPing.provider,
        databaseUrlConfigured: Boolean(getDatabaseUrl()),
        redisConfigured: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
        databaseHost: dbStats.databaseHost,
        tableCount: dbStats.tableCount,
        databaseSizeBytes: dbStats.databaseSizeBytes,
        databaseSizeMb: dbStats.databaseSizeMb,
        storageLimitMb: NEON_FREE_PLAN_LIMIT_MB,
        fileStorageBytes: dbStats.fileStorageBytes,
        fileStorageMb: dbStats.fileStorageMb,
        fileCount: dbStats.fileCount
      }
    });
  } catch (err) {
    console.error("[Admin Metrics Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error reading metrics." });
  }
});
router4.get("/admin/activity", requireModerator, async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : "";
    const category = req.query.category ? String(req.query.category).trim().toLowerCase() : "all";
    const actorEmail = req.query.actorEmail ? String(req.query.actorEmail).trim().toLowerCase() : "";
    const actionFilter = req.query.action ? String(req.query.action).trim().toUpperCase() : "";
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (q) {
      conditions.push(
        `(LOWER(action) LIKE $${paramIndex} OR LOWER(COALESCE(actor_email, '')) LIKE $${paramIndex} OR LOWER(COALESCE(target_type, '')) LIKE $${paramIndex} OR LOWER(COALESCE(target_id, '')) LIKE $${paramIndex} OR LOWER(CAST(details AS TEXT)) LIKE $${paramIndex})`
      );
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (actorEmail) {
      conditions.push(`LOWER(COALESCE(actor_email, '')) = $${paramIndex}`);
      params.push(actorEmail);
      paramIndex++;
    }
    if (actionFilter) {
      conditions.push(`action = $${paramIndex}`);
      params.push(actionFilter);
      paramIndex++;
    }
    if (category === "users") {
      conditions.push(
        `action IN ('USER_REGISTERED','BUYER_UPGRADED_TO_SELLER','USER_LOGIN','USER_LOGIN_FAILED','USER_LOGOUT','OTP_REQUESTED','OTP_VERIFIED','OTP_VERIFY_FAILED','PASSWORD_CHANGED','PASSWORD_RESET_COMPLETED','PASSWORD_RESET_FAILED','ADMIN_USER_DELETED','ADMIN_USER_BANNED','ADMIN_USER_UNBANNED','ADMIN_PASSWORD_RESET')`
      );
    } else if (category === "orders_payments") {
      conditions.push(
        `action IN ('CHECKOUT_INITIALIZED','ORDER_PAYMENT_VERIFIED','ORDER_PAID_WEBHOOK','ORDER_STATUS_CHANGED','PAYMENT_REFUND_EXECUTED','SELLER_WITHDRAWAL_DISPATCHED','PAYOUT_ACCOUNT_LINKED','MINOR_GUARDIAN_PAYOUT_ACCOUNT_LINKED','MINOR_PAYOUT_ACCOUNT_APPROVED','ORDER_ADMIN_HOLD_UPDATED','PAYOUT_WEBHOOK_PROCESSED','COUPON_VALIDATED','CRON_DAILY_PROCESSED','ADMIN_ESCROW_SCAN_TRIGGERED')`
      );
    } else if (category === "marketplace") {
      conditions.push(
        `action IN ('PRODUCT_CREATED','PRODUCT_UPDATED','PRODUCT_DELETED','SELLER_PROFILE_UPDATED','CHAT_CONVERSATION_STARTED','CHAT_MESSAGE_SENT','COMMISSION_REQUESTED','COMMISSION_SUBMITTED','REVIEW_SUBMITTED','CART_UPDATED','WISHLIST_UPDATED')`
      );
    } else if (category === "security") {
      conditions.push(
        `(action LIKE 'ADMIN_%' OR action LIKE 'NIN_%' OR action LIKE 'VERIFICATION_%' OR action LIKE '%BYPASS%' OR action IN ('REPORT_SUBMITTED','REPORT_STATUS_UPDATED','DISPUTE_OPENED','DISPUTE_RESOLVED','FLAG_ACTION_APPLIED','BROADCAST_UPDATED','BROADCAST_ACTIVATED','BROADCAST_DEACTIVATED','KILLSWITCH_TOGGLED','FEE_SETTINGS_UPDATED','WEBHOOK_SIGNATURE_REJECTED','DUPLICATE_NIN_FLAGGED','KYC_DOCUMENT_ACCESSED','NDPA_DATA_PURGED','ORDER_STATUS_IDOR_BLOCKED','WALLET_FREEZE_UPDATED','SUPPORT_CONTACT_SUBMITTED','USER_LOGIN_FAILED'))`
      );
    } else if (category === "browsing") {
      conditions.push(
        `action IN ('PAGE_VIEWED','PRODUCT_VIEWED','SELLER_SHOP_VIEWED','MARKETPLACE_SEARCHED','CATEGORY_FILTERED','CART_ITEM_ADDED','CART_ITEM_REMOVED','CART_CLEARED','WISHLIST_TOGGLED','CHECKOUT_OPENED','AUTH_MODAL_OPENED','STYLE_POST_SUBMITTED','REFERRAL_CODE_APPLIED')`
      );
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    const [countRes, rowsRes, summaryRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM shopit_audit_logs ${whereClause}`, params),
      query(
        `SELECT id, action, actor_id, actor_email, actor_role, target_type, target_id, details, ip_address, user_agent, created_at
         FROM shopit_audit_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      query(
        `SELECT
           COUNT(*) as total_events,
           COUNT(CASE WHEN created_at >= $1 THEN 1 END) as events_24h,
           COUNT(CASE WHEN action = 'USER_REGISTERED' AND created_at >= $1 THEN 1 END) as new_users_24h,
           COUNT(CASE WHEN action IN ('WEBHOOK_SIGNATURE_REJECTED','CHAT_BYPASS_BLOCKED','DUPLICATE_NIN_FLAGGED','ORDER_STATUS_IDOR_BLOCKED','REPORT_SUBMITTED','DISPUTE_OPENED','USER_LOGIN_FAILED') AND created_at >= $1 THEN 1 END) as security_alerts_24h
         FROM shopit_audit_logs`,
        [cutoff24h]
      )
    ]);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);
    const events = rowsRes.rows.map((row) => {
      let parsedDetails = {};
      if (row.details) {
        if (typeof row.details === "string") {
          try {
            parsedDetails = JSON.parse(row.details);
          } catch {
            parsedDetails = { message: row.details };
          }
        } else if (typeof row.details === "object") {
          parsedDetails = row.details;
        }
      }
      return {
        id: row.id,
        action: row.action,
        actorId: row.actor_id,
        actorEmail: row.actor_email || "guest@visitor",
        actorRole: row.actor_role || "visitor",
        targetType: row.target_type,
        targetId: row.target_id,
        details: parsedDetails,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at
      };
    });
    return res.json({
      status: true,
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalEvents: parseInt(summaryRes.rows[0]?.total_events || "0", 10),
        eventsLast24h: parseInt(summaryRes.rows[0]?.events_24h || "0", 10),
        newUsersLast24h: parseInt(summaryRes.rows[0]?.new_users_24h || "0", 10),
        securityAlertsCount: parseInt(summaryRes.rows[0]?.security_alerts_24h || "0", 10)
      }
    });
  } catch (err) {
    console.error("[Admin Activity Error]:", err.message);
    return res.status(500).json({ status: false, message: "Database error reading website activity." });
  }
});
router4.post("/admin/audit", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const rawAction = String(req.body?.action || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 64);
    if (!rawAction) {
      return res.status(400).json({ status: false, message: "Valid action code is required." });
    }
    const targetType = String(req.body?.targetType || "admin_panel").slice(0, 60);
    const targetId = req.body?.targetId ? String(req.body.targetId).slice(0, 120) : void 0;
    const summaryText = req.body?.summary ? String(req.body.summary).slice(0, 500) : void 0;
    const rawMeta = req.body?.details && typeof req.body.details === "object" ? req.body.details : {};
    const safeDetails = summaryText ? { summary: summaryText } : {};
    for (const [k, v] of Object.entries(rawMeta).slice(0, 12)) {
      if (!/password|secret|token|otp|nin/i.test(k)) {
        safeDetails[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 200) : v;
      }
    }
    await logAuditEvent({
      action: rawAction,
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: targetType, id: targetId },
      details: safeDetails,
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({ status: true, message: "Admin audit event recorded." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to record admin audit event." });
  }
});
router4.put("/admin/broadcast", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const current = await getPlatformSetting("broadcast", DEFAULT_BROADCAST_SETTING);
    const body = req.body || {};
    const validTones = /* @__PURE__ */ new Set(["info", "warning", "emergency", "promo"]);
    const nextTone = body.tone && validTones.has(String(body.tone)) ? String(body.tone) : current.tone;
    const nextTitle = body.title !== void 0 ? String(body.title).trim().slice(0, 140) : current.title;
    const nextMessage = body.message !== void 0 ? String(body.message).trim().slice(0, 500) : current.message;
    const nextActive = body.isActive !== void 0 ? Boolean(body.isActive) : Boolean(current.isActive);
    const updated = {
      id: `broad_${Date.now()}`,
      isActive: nextActive,
      title: nextTitle || "Platform Notice",
      message: nextMessage || "",
      tone: nextTone,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      author: user.name || user.email || "Shop It Safety Desk"
    };
    await setPlatformSetting("broadcast", updated, user.email);
    await logAuditEvent({
      action: body.isActive !== void 0 ? nextActive ? "BROADCAST_ACTIVATED" : "BROADCAST_DEACTIVATED" : "BROADCAST_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "platform_setting", id: "broadcast" },
      details: { isActive: updated.isActive, tone: updated.tone, title: updated.title },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, broadcastAnnouncement: updated, message: "Broadcast saved in PostgreSQL." });
  } catch (err) {
    console.error("[Broadcast Update Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to save broadcast announcement in database." });
  }
});
router4.put("/admin/emergency-controls", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const current = await getPlatformSetting("emergency_controls", DEFAULT_EMERGENCY_CONTROLS);
    const body = req.body || {};
    const updated = {
      maintenanceMode: body.maintenanceMode !== void 0 ? Boolean(body.maintenanceMode) : Boolean(current.maintenanceMode),
      pauseNewOrders: body.pauseNewOrders !== void 0 ? Boolean(body.pauseNewOrders) : Boolean(current.pauseNewOrders),
      pauseSellerSignups: body.pauseSellerSignups !== void 0 ? Boolean(body.pauseSellerSignups) : Boolean(current.pauseSellerSignups)
    };
    await setPlatformSetting("emergency_controls", updated, user.email);
    await logAuditEvent({
      action: "KILLSWITCH_TOGGLED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "platform_setting", id: "emergency_controls" },
      details: updated,
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, emergencyControls: updated, message: "Emergency killswitches saved in PostgreSQL." });
  } catch (err) {
    console.error("[Emergency Controls Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to update emergency killswitches in database." });
  }
});
router4.put("/admin/fee-settings", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const current = await getPlatformSetting("fee_settings", DEFAULT_FEE_SETTINGS_DB);
    const body = req.body || {};
    const parsedLow = body.tierLowFee !== void 0 ? Math.max(0, Math.min(5e4, Number(body.tierLowFee) || 0)) : current.tierLowFee;
    const parsedMid = body.tierMidFee !== void 0 ? Math.max(0, Math.min(1e5, Number(body.tierMidFee) || 0)) : current.tierMidFee;
    const parsedHigh = body.tierHighPercentage !== void 0 ? Math.max(0, Math.min(0.25, Number(body.tierHighPercentage) || 0)) : current.tierHighPercentage;
    const parsedMinWd = body.minWithdrawal !== void 0 ? Math.max(100, Math.min(1e5, Number(body.minWithdrawal) || 1e3)) : current.minWithdrawal;
    const updated = {
      firstMonthPromoFree: body.firstMonthPromoFree !== void 0 ? Boolean(body.firstMonthPromoFree) : Boolean(current.firstMonthPromoFree),
      tierLowFee: parsedLow,
      tierMidFee: parsedMid,
      tierHighPercentage: parsedHigh,
      minWithdrawal: parsedMinWd
    };
    await setPlatformSetting("fee_settings", updated, user.email);
    await logAuditEvent({
      action: "FEE_SETTINGS_UPDATED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "platform_setting", id: "fee_settings" },
      details: updated,
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, feeSettings: updated, message: "Fee settings saved in PostgreSQL." });
  } catch (err) {
    console.error("[Fee Settings Error]:", err.message);
    return res.status(500).json({ status: false, message: "Failed to update fee settings in database." });
  }
});
var ALLOWED_WEBSITE_ACTIVITY_ACTIONS = /* @__PURE__ */ new Set([
  "PAGE_VIEWED",
  "PRODUCT_VIEWED",
  "SELLER_SHOP_VIEWED",
  "MARKETPLACE_SEARCHED",
  "CATEGORY_FILTERED",
  "CART_ITEM_ADDED",
  "CART_ITEM_REMOVED",
  "CART_CLEARED",
  "WISHLIST_TOGGLED",
  "REVIEW_SUBMITTED",
  "CHECKOUT_OPENED",
  "AUTH_MODAL_OPENED",
  "COMMISSION_SUBMITTED",
  "STYLE_POST_SUBMITTED",
  "REFERRAL_CODE_APPLIED"
]);
router4.post("/activity/track", optionalAuth, async (req, res) => {
  try {
    const clientIp = req.ip || "unknown";
    const rl = await checkAndRecordRateLimit(`activity_track:${clientIp}`, 120, 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: "Too many activity events." });
    }
    const action = String(req.body?.action || "").trim().toUpperCase();
    if (!ALLOWED_WEBSITE_ACTIVITY_ACTIONS.has(action)) {
      return res.status(400).json({ status: false, message: "Unsupported activity event type." });
    }
    const targetType = req.body?.targetType ? String(req.body.targetType).trim().slice(0, 60) : "website";
    const targetId = req.body?.targetId ? String(req.body.targetId).trim().slice(0, 120) : void 0;
    const rawDetails = req.body?.details && typeof req.body.details === "object" ? req.body.details : {};
    const safeDetails = {};
    for (const [k, v] of Object.entries(rawDetails).slice(0, 10)) {
      if (/password|secret|token|otp|nin|cvv|pin/i.test(k)) continue;
      if (typeof v === "string") {
        safeDetails[k.slice(0, 40)] = v.slice(0, 200);
      } else if (typeof v === "number" || typeof v === "boolean") {
        safeDetails[k.slice(0, 40)] = v;
      }
    }
    const visitorId = req.body?.visitorId ? String(req.body.visitorId).slice(0, 64) : void 0;
    const actor = req.user ? { id: req.user.userId, email: req.user.email, role: req.user.role } : { id: visitorId || "guest", email: "guest@visitor", role: "visitor" };
    await logAuditEvent({
      action,
      actor,
      target: { type: targetType, id: targetId },
      details: safeDetails,
      ip: clientIp,
      userAgent: req.get("user-agent")
    });
    return res.status(201).json({ status: true });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to log activity." });
  }
});
router4.get("/admin/export-data", requireAdmin, async (req, res) => {
  try {
    const [
      usersRes,
      sellersRes,
      productsRes,
      ordRes,
      payRes,
      walletsRes,
      ledgerRes,
      disputesRes,
      repRes,
      verifRes,
      alertsRes
    ] = await Promise.all([
      query(
        `SELECT id, email, name, display_name, profile_slug, bio, campus, location_area,
                role, sub_role, is_verified_email, age, has_guardian_consent, guardian_name,
                is_banned, ban_reason, deleted_at, last_login_at, created_at, updated_at
         FROM shopit_users ORDER BY created_at DESC LIMIT 2000`
      ),
      query(
        `SELECT id, user_id, shop_name, owner_name, email, bio, campus,
                location_state, location_city, location_area,
                is_verified_seller, verification_status, verified_nin_last4, verified_at,
                under_18, guardian_consent, guardian_name, rating, sales_count, views_count,
                vacation_mode, created_at, updated_at
         FROM shopit_sellers ORDER BY created_at DESC LIMIT 2000`
      ),
      query(
        `SELECT id, seller_id, seller_shop_name, seller_campus, title, description, category,
                seller_price_kobo, service_fee_kobo, display_price_kobo, stock, images,
                delivery_pickup_fee_kobo, delivery_local_fee_kobo, delivery_buyer_arranges,
                location_state, location_city, location_area, is_sold_out, is_paused, is_draft,
                created_at, updated_at
         FROM shopit_products ORDER BY created_at DESC LIMIT 2000`
      ),
      query(
        `SELECT id, buyer_id, buyer_name, buyer_email, buyer_masked_id, items,
                subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo,
                coupon_code, grand_total_kobo, payment_method, payment_reference,
                status, campus, delivery_area, pickup_point, admin_hold,
                paid_at, shipped_at, delivered_at, completed_at, created_at, updated_at
         FROM shopit_orders ORDER BY created_at DESC LIMIT 2000`
      ),
      query(
        `SELECT reference, order_id, amount_kobo, currency, channel, status,
                webhook_received, customer_email, created_at, updated_at
         FROM shopit_payments ORDER BY created_at DESC LIMIT 2000`
      ),
      query(
        `SELECT seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo,
                is_frozen, freeze_reason, created_at, updated_at
         FROM shopit_wallets ORDER BY updated_at DESC LIMIT 2000`
      ),
      query(
        `SELECT id, wallet_id, order_id, type, amount_kobo, fee_kobo, balance_after_kobo,
                balance_type, status, description, reference, idempotency_key, created_at
         FROM shopit_ledger_entries ORDER BY created_at DESC LIMIT 5000`
      ),
      query(
        `SELECT id, order_id, buyer_id, seller_id, reason, description, status, amount_held_in_escrow_kobo,
                resolution_notes, created_at, updated_at
         FROM shopit_disputes ORDER BY created_at DESC LIMIT 2000`
      ),
      query(
        `SELECT id, target_type, target_id, target_title, reason, details, status, action_logs, created_at
         FROM shopit_reports ORDER BY created_at DESC LIMIT 2000`
      ),
      query(
        `SELECT id, seller_id, user_id, shop_name, owner_name, id_type, id_number_masked,
                full_nin_last4, under_18, status, submitted_at, reviewed_at
         FROM shopit_verifications ORDER BY submitted_at DESC LIMIT 2000`
      ),
      query(
        `SELECT alert_key, id, alert_type, user_id, user_email, user_name, user_role,
                title, message, is_read, metadata, created_at
         FROM shopit_admin_alerts ORDER BY created_at DESC LIMIT 2000`
      )
    ]);
    const exportPayload = {
      version: "3.0",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exportedBy: req.user.email,
      platform: OPERATOR_INFO.platformLabel,
      summary: {
        totalUsers: usersRes.rows.length,
        totalSellers: sellersRes.rows.length,
        totalProducts: productsRes.rows.length,
        totalOrders: ordRes.rows.length,
        totalPayments: payRes.rows.length,
        totalWallets: walletsRes.rows.length,
        totalLedgerEntries: ledgerRes.rows.length,
        totalDisputes: disputesRes.rows.length,
        totalReports: repRes.rows.length,
        totalVerifications: verifRes.rows.length,
        totalAdminAlerts: alertsRes.rows.length
      },
      users: usersRes.rows,
      sellers: sellersRes.rows,
      products: productsRes.rows,
      orders: ordRes.rows,
      payments: payRes.rows,
      wallets: walletsRes.rows,
      ledger: ledgerRes.rows,
      disputes: disputesRes.rows,
      reports: repRes.rows,
      verifications: verifRes.rows,
      adminAlerts: alertsRes.rows
    };
    await logAuditEvent({
      action: "ADMIN_DATA_EXPORTED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "system", id: "export" },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="shopit-backup-${Date.now()}.json"`);
    return res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.get("/payments/config", (_req, res) => {
  res.json({
    status: true,
    gateway: "flutterwave",
    publicKey: getFlwPublicKey(),
    isSecretConfigured: Boolean(getFlwSecretKey()),
    isWebhookSecretConfigured: Boolean(getFlwWebhookHash()),
    webhookPath: "/api/webhooks/flutterwave",
    webhookUrl: `${APP_URL}/api/webhooks/flutterwave`,
    minWithdrawal: 1e3,
    coolingPeriodHours: 24
  });
});
router4.get("/payments/webhook-info", (_req, res) => {
  res.json({
    gateway: "flutterwave",
    webhookPath: "/api/webhooks/flutterwave",
    webhookUrl: `${APP_URL}/api/webhooks/flutterwave`,
    method: "POST",
    signatureHeader: "verif-hash",
    isConfigured: Boolean(getFlwSecretKey() && getFlwWebhookHash())
  });
});
router4.get("/payments/banks", requireAuth, async (_req, res) => {
  const flwSecret = getFlwSecretKey();
  if (!flwSecret) {
    return res.status(503).json({
      status: false,
      error: "PAYMENT_GATEWAY_NOT_CONFIGURED",
      message: "Bank directory is unavailable because FLW_SECRET_KEY is not configured."
    });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    let bankRes;
    let bankData;
    try {
      bankRes = await fetch("https://api.flutterwave.com/v3/banks/NG", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });
      bankData = await bankRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }
    if (!bankRes.ok || bankData?.status !== "success" || !Array.isArray(bankData?.data)) {
      return res.status(502).json({
        status: false,
        message: bankData?.message || "Unable to load supported Nigerian banks from Flutterwave."
      });
    }
    const banks = bankData.data.filter((b) => b && b.code && b.name).map((b) => ({
      code: String(b.code).trim(),
      name: String(b.name).trim()
    })).sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ status: true, banks });
  } catch (err) {
    return res.status(502).json({ status: false, message: `Bank list lookup failed: ${err.message}` });
  }
});
router4.post("/payments/resolve-account", requireAuth, async (req, res) => {
  const flwSecret = getFlwSecretKey();
  if (!flwSecret) {
    return res.status(503).json({
      status: false,
      error: "PAYMENT_GATEWAY_NOT_CONFIGURED",
      message: "Account resolution requires FLW_SECRET_KEY."
    });
  }
  const accountNumber = String(req.body?.accountNumber || "").trim();
  const bankCode = String(req.body?.bankCode || "").trim();
  if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
    return res.status(400).json({ status: false, message: "Valid 10-digit accountNumber and bankCode are required." });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    let resolveRes;
    let resolveData;
    try {
      resolveRes = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank: bankCode
        }),
        signal: controller.signal
      });
      resolveData = await resolveRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }
    if (!resolveRes.ok || resolveData?.status !== "success" || !resolveData?.data?.account_name) {
      return res.status(400).json({
        status: false,
        message: resolveData?.message || "Could not resolve Nigerian bank account with Flutterwave."
      });
    }
    return res.json({
      status: true,
      accountNumber: String(resolveData.data.account_number || accountNumber),
      accountName: String(resolveData.data.account_name).trim(),
      bankCode
    });
  } catch (err) {
    return res.status(502).json({ status: false, message: `Account verification error: ${err.message}` });
  }
});
router4.post("/payments/initialize", requirePaymentsEnabled, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const emergency = await getPlatformSetting("emergency_controls", DEFAULT_EMERGENCY_CONTROLS);
    if ((emergency.pauseNewOrders || emergency.maintenanceMode) && user.role !== "admin") {
      return res.status(503).json({
        status: false,
        error: "ORDERS_PAUSED",
        message: "Checkout and new orders are temporarily paused by platform moderation."
      });
    }
    const rl = await checkAndRecordRateLimit(`pay_init:${user.userId}`, 20, 5 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: "Too many checkout attempts. Please wait a minute." });
    }
    const flwSecret = getFlwSecretKey();
    if (!flwSecret) {
      return res.status(503).json({
        status: false,
        error: "PAYMENT_GATEWAY_NOT_CONFIGURED",
        message: "Payment gateway is not configured on this server."
      });
    }
    const { items, couponCode, campus, deliveryArea, pickupPoint, paymentMethod } = req.body;
    const buyerEmail = user.email;
    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ status: false, message: "Valid cart items are required." });
    }
    await runLazyPendingOrderExpiry();
    const feePolicy = await getPlatformSetting("fee_settings", DEFAULT_FEE_SETTINGS_DB);
    const initializedOrder = await withTransaction(async (client) => {
      const resolvedItems = [];
      const sellerGroups = /* @__PURE__ */ new Map();
      let subtotalKobo = 0;
      let serviceFeeKobo = 0;
      for (const reqItem of items) {
        const productId = String(reqItem.productId || "").trim();
        const qty = Math.max(1, Math.min(50, Math.floor(Number(reqItem.quantity) || 1)));
        const deliveryMethod = reqItem.deliveryMethod === "pickup" ? "pickup" : "delivery";
        if (!productId) {
          throw Object.assign(new Error("Each cart item must include productId."), { statusCode: 400 });
        }
        const pRes = await client.query(
          `SELECT id, seller_id, seller_shop_name, seller_campus, title, images,
                  seller_price_kobo, stock, is_sold_out, delivery_pickup_fee_kobo, delivery_local_fee_kobo
           FROM shopit_products
           WHERE id = $1
           FOR UPDATE`,
          [productId]
        );
        if (pRes.rows.length === 0) {
          throw Object.assign(new Error(`Product "${productId}" was not found.`), { statusCode: 404 });
        }
        const p = pRes.rows[0];
        if (String(p.seller_id) === String(user.userId) || user.sellerId && String(p.seller_id) === String(user.sellerId)) {
          throw Object.assign(new Error("You cannot buy your own product."), { statusCode: 400 });
        }
        const currentStock = Math.max(0, parseInt(String(p.stock || "0"), 10));
        if (Boolean(p.is_sold_out) || currentStock < qty) {
          throw Object.assign(new Error(`"${p.title}" does not have enough stock available.`), { statusCode: 400 });
        }
        const nextStock = currentStock - qty;
        await client.query(
          "UPDATE shopit_products SET stock = $1, is_sold_out = $2, updated_at = NOW() WHERE id = $3",
          [nextStock, nextStock <= 0, p.id]
        );
        const sellerPriceKobo = Math.max(0, Math.round(Number(p.seller_price_kobo || 0)));
        if (sellerPriceKobo <= 0) {
          throw Object.assign(new Error(`Invalid server price on "${p.title}".`), { statusCode: 400 });
        }
        const itemServiceFeeKobo = calculateConfiguredServiceFeeKobo(sellerPriceKobo, feePolicy);
        subtotalKobo += sellerPriceKobo * qty;
        serviceFeeKobo += itemServiceFeeKobo * qty;
        const rawDeliveryKobo = deliveryMethod === "pickup" ? Number(p.delivery_pickup_fee_kobo || 2e4) : Number(p.delivery_local_fee_kobo || 5e4);
        const itemDeliveryKobo = Math.max(
          0,
          Math.round(rawDeliveryKobo > 0 ? rawDeliveryKobo : deliveryMethod === "pickup" ? 2e4 : 5e4)
        );
        const sKey = String(p.seller_id);
        const prevGroup = sellerGroups.get(sKey);
        if (!prevGroup || itemDeliveryKobo > prevGroup.deliveryFeeKobo) {
          sellerGroups.set(sKey, { deliveryFeeKobo: itemDeliveryKobo });
        }
        resolvedItems.push({
          productId: p.id,
          title: p.title,
          image: Array.isArray(p.images) ? p.images[0] || "" : "",
          sellerId: p.seller_id,
          sellerShopName: p.seller_shop_name || "Artisan Shop",
          sellerCampus: p.seller_campus || campus || "Campus",
          quantity: qty,
          sellerPrice: koboToNaira(sellerPriceKobo),
          sellerPriceKobo,
          serviceFee: koboToNaira(itemServiceFeeKobo),
          displayPrice: koboToNaira(sellerPriceKobo + itemServiceFeeKobo),
          deliveryMethod,
          deliveryFee: koboToNaira(itemDeliveryKobo)
        });
      }
      let deliveryTotalKobo = 0;
      for (const group of sellerGroups.values()) {
        deliveryTotalKobo += group.deliveryFeeKobo;
      }
      let discountTotalKobo = 0;
      let appliedCouponCode = null;
      if (couponCode && String(couponCode).trim()) {
        const cleanCode = String(couponCode).trim().toUpperCase();
        const cRes = await client.query(
          "SELECT code, discount_kobo, min_subtotal_kobo, is_active, max_uses, current_uses, expires_at FROM shopit_coupons WHERE code = $1",
          [cleanCode]
        );
        const c = cRes.rows[0];
        if (c && c.is_active && subtotalKobo >= Number(c.min_subtotal_kobo) && (!c.expires_at || new Date(c.expires_at).getTime() > Date.now()) && (!c.max_uses || Number(c.current_uses) < Number(c.max_uses))) {
          discountTotalKobo = Math.min(Number(c.discount_kobo), subtotalKobo);
          appliedCouponCode = cleanCode;
        }
      }
      const grandTotalKobo = Math.max(1e4, subtotalKobo + serviceFeeKobo + deliveryTotalKobo - discountTotalKobo);
      const orderId = `ORD-${Date.now()}-${crypto12.randomBytes(3).toString("hex").toUpperCase()}`;
      const reference = `SHOPIT_${Date.now()}_${crypto12.randomBytes(4).toString("hex").toUpperCase()}`;
      const handshakeOtp = String(crypto12.randomInt(1e3, 1e4));
      const buyerDisplayRes = await client.query("SELECT display_name, name FROM shopit_users WHERE id = $1 LIMIT 1", [user.userId]);
      const buyerDisplayLabel = buyerDisplayRes.rows[0]?.display_name || extractFirstName(buyerDisplayRes.rows[0]?.name || user.name || "Buyer");
      await client.query(
        `INSERT INTO shopit_orders (
          id, buyer_id, buyer_name, buyer_email, buyer_masked_id, items,
          subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, coupon_code,
          grand_total_kobo, payment_method, payment_reference,
          handshake_otp, handshake_verified, status, stock_reserved, expires_at,
          campus, delivery_area, pickup_point, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14,
          $15, false, 'pending_payment', true, NOW() + INTERVAL '60 minutes',
          $16, $17, $18, NOW(), NOW()
        )`,
        [
          orderId,
          user.userId,
          user.name,
          buyerEmail,
          buyerDisplayLabel,
          JSON.stringify(resolvedItems),
          subtotalKobo,
          serviceFeeKobo,
          deliveryTotalKobo,
          discountTotalKobo,
          appliedCouponCode,
          grandTotalKobo,
          paymentMethod || "flutterwave_card",
          reference,
          handshakeOtp,
          campus || "Lagos Mainland",
          deliveryArea || campus || "Campus Hub",
          pickupPoint || "Main Security Gate Hub"
        ]
      );
      await client.query(
        `INSERT INTO shopit_payments (
          reference, order_id, amount_kobo, currency, channel, status, webhook_received, customer_email, updated_at
        ) VALUES ($1, $2, $3, 'NGN', $4, 'pending_payment', false, $5, NOW())`,
        [reference, orderId, grandTotalKobo, paymentMethod || "card", buyerEmail]
      );
      return {
        orderId,
        reference,
        resolvedItems,
        pricing: {
          subtotal: koboToNaira(subtotalKobo),
          serviceFeeTotal: koboToNaira(serviceFeeKobo),
          deliveryTotal: koboToNaira(deliveryTotalKobo),
          discountTotal: koboToNaira(discountTotalKobo),
          grandTotalNaira: koboToNaira(grandTotalKobo),
          amountInKobo: grandTotalKobo
        }
      };
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12e3);
    let flwRes = null;
    let flwData = {};
    try {
      flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tx_ref: initializedOrder.reference,
          amount: initializedOrder.pricing.grandTotalNaira,
          currency: "NGN",
          redirect_url: `${APP_URL}/?view=orders&payment_ref=${encodeURIComponent(initializedOrder.reference)}`,
          payment_options: "card, banktransfer, ussd, opay",
          customer: {
            email: buyerEmail,
            name: user.name || "Shop It Buyer"
          },
          customizations: {
            title: "Shop It Checkout",
            description: `Order #${initializedOrder.orderId} (${campus || "Nigeria"})`
          },
          meta: {
            orderId: initializedOrder.orderId,
            buyerId: user.userId,
            campus: campus || "Nigeria"
          }
        }),
        signal: controller.signal
      });
      flwData = await flwRes.json().catch(() => ({}));
    } catch (gatewayErr) {
      flwData = { message: gatewayErr?.message || "Flutterwave API timeout or connection error." };
    } finally {
      clearTimeout(timeout);
    }
    if (!flwRes || !flwRes.ok || flwData?.status !== "success" || !flwData?.data?.link) {
      await withTransaction(async (client) => {
        await restoreOrderStockInTx(client, {
          id: initializedOrder.orderId,
          items: initializedOrder.resolvedItems,
          stock_reserved: true
        });
        await client.query(
          "UPDATE shopit_orders SET status = 'cancelled', stock_reserved = false, notes = 'Gateway init failed', updated_at = NOW() WHERE id = $1",
          [initializedOrder.orderId]
        );
        await client.query("UPDATE shopit_payments SET status = 'failed', updated_at = NOW() WHERE reference = $1", [
          initializedOrder.reference
        ]);
      }).catch(() => {
      });
      return res.status(502).json({
        status: false,
        message: flwData?.message || "Unable to initialize payment with Flutterwave. Please try again."
      });
    }
    await logAuditEvent({
      action: "CHECKOUT_INITIALIZED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "order", id: initializedOrder.orderId },
      details: {
        reference: initializedOrder.reference,
        amountNaira: initializedOrder.pricing.grandTotalNaira,
        itemCount: initializedOrder.resolvedItems.length,
        campus: campus || "Nigeria"
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    const responseData = {
      gateway: "flutterwave",
      reference: initializedOrder.reference,
      orderId: initializedOrder.orderId,
      amountInKobo: initializedOrder.pricing.amountInKobo,
      amountNaira: initializedOrder.pricing.grandTotalNaira,
      grandTotalNaira: initializedOrder.pricing.grandTotalNaira,
      authorizationUrl: flwData.data.link,
      authorization_url: flwData.data.link,
      publicKey: getFlwPublicKey(),
      pricing: initializedOrder.pricing
    };
    return res.json({ status: true, ...responseData, data: responseData });
  } catch (err) {
    const code = err?.statusCode || 500;
    if (code >= 500) console.error("[Payment Init Error]:", err.message);
    return res.status(code).json({ status: false, message: err.message || "Internal server error initializing payment." });
  }
});
router4.get("/webhooks/flutterwave", (_req, res) => {
  return res.status(200).json({ status: "ok", message: "POST only" });
});
router4.all("/webhooks/flutterwave", requirePaymentsEnabled, async (req, res) => {
  return handler(req, res);
});
router4.get("/payments/verify/:reference", requirePaymentsEnabled, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { reference } = req.params;
    const transactionId = req.query.transaction_id ? String(req.query.transaction_id).trim() : "";
    if (!reference) {
      return res.status(400).json({ status: false, message: "Reference is required." });
    }
    const orderRes = await query("SELECT * FROM shopit_orders WHERE payment_reference = $1", [reference]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Payment reference not found." });
    }
    const order = orderRes.rows[0];
    if (order.buyer_id !== user.userId && user.role !== "admin") {
      return res.status(403).json({ status: false, message: "Forbidden: you cannot verify another buyer\u2019s order." });
    }
    if (["paid", "packed", "shipped", "delivered", "completed"].includes(order.status)) {
      const amountInKobo = parseInt(String(order.grand_total_kobo || "0"), 10);
      return res.json({
        status: true,
        isPaid: true,
        orderStatus: order.status,
        reference,
        orderId: order.id,
        amountInKobo,
        amountNaira: koboToNaira(amountInKobo),
        currency: "NGN",
        message: "Transaction already verified and paid."
      });
    }
    const flwSecret = getFlwSecretKey();
    if (!flwSecret) {
      return res.status(503).json({ status: false, message: "Payment verification secret not configured." });
    }
    const verifyUrl = transactionId ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify` : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    let verifyRes;
    let verifyData;
    try {
      verifyRes = await fetch(verifyUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${flwSecret}`, "Content-Type": "application/json" },
        signal: controller.signal
      });
      verifyData = await verifyRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }
    if (!verifyRes.ok || verifyData?.status !== "success" || verifyData?.data?.status !== "successful") {
      if (order.status === "cancelled") {
        return res.status(409).json({
          status: false,
          isPaid: false,
          expired: true,
          orderStatus: "cancelled",
          message: "Checkout order expired or was cancelled before payment."
        });
      }
      return res.json({
        status: true,
        isPaid: false,
        orderStatus: order.status,
        gatewayStatus: verifyData?.data?.status || "pending",
        message: verifyData?.message || "Payment not yet confirmed with Flutterwave."
      });
    }
    if (String(verifyData.data.tx_ref || "").trim() !== reference) {
      return res.status(400).json({ status: false, isPaid: false, message: "Verified tx_ref mismatch." });
    }
    const confirmedAmountKobo = Math.round(Number(verifyData.data.amount || 0) * 100);
    const channel = String(verifyData.data.payment_type || "card");
    const settlement = await commitPaidOrderTransaction({
      reference,
      confirmedAmountKobo,
      currency: String(verifyData.data.currency || "").toUpperCase(),
      channel,
      webhookReceived: false,
      customerEmail: verifyData.data.customer?.email || user.email,
      gatewayData: {
        flwTransactionId: verifyData.data.id,
        flwRef: verifyData.data.flw_ref,
        processorResponse: verifyData.data.processor_response,
        paymentType: channel
      },
      source: "verify_endpoint"
    });
    if (settlement.currencyMismatch || settlement.amountMismatch) {
      return res.status(400).json({ status: false, isPaid: false, message: "Currency or paid amount mismatch." });
    }
    if (settlement.expired) {
      return res.status(409).json({
        status: false,
        isPaid: false,
        expired: true,
        orderStatus: "cancelled",
        message: "Order expired before payment cleared and has been flagged for admin refund."
      });
    }
    if (settlement.committed) {
      await logAuditEvent({
        action: "ORDER_PAYMENT_VERIFIED",
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: "order", id: order.id },
        details: { reference, amountNaira: koboToNaira(confirmedAmountKobo), channel },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
    }
    return res.json({
      status: true,
      isPaid: Boolean(settlement.committed || settlement.alreadyPaid),
      orderStatus: "paid",
      reference,
      orderId: order.id,
      amountInKobo: confirmedAmountKobo,
      amountNaira: koboToNaira(confirmedAmountKobo),
      currency: "NGN",
      channel,
      message: "Payment verified with Flutterwave and held for order delivery."
    });
  } catch (err) {
    console.error("[Payment Verify Error]:", err.message);
    return res.status(502).json({ status: false, message: "Could not verify payment with Flutterwave." });
  }
});
router4.post("/payments/refund", requirePaymentsEnabled, requireAdmin, async (req, res) => {
  const user = req.user;
  const { reference, orderId, amountKobo, reason } = req.body;
  if (!reference && !orderId) {
    return res.status(400).json({ status: false, message: "Payment reference or orderId is required for refund." });
  }
  try {
    const flwSecret = getFlwSecretKey();
    if (!flwSecret) {
      return res.status(503).json({ status: false, message: "Payment gateway secret is not configured." });
    }
    const orderLookup = await query("SELECT * FROM shopit_orders WHERE payment_reference = $1 OR id = $2", [
      reference || "",
      orderId || ""
    ]);
    const targetOrder = orderLookup.rows[0] || null;
    const effectiveRef = reference || targetOrder?.payment_reference || "";
    const payLookup = await query("SELECT * FROM shopit_payments WHERE reference = $1 OR order_id = $2", [
      effectiveRef,
      targetOrder?.id || orderId || ""
    ]);
    const paymentRow = payLookup.rows[0] || null;
    if (paymentRow?.status === "refunded" && targetOrder && ["refunded", "cancelled"].includes(targetOrder.status)) {
      return res.json({
        status: true,
        alreadyRefunded: true,
        message: "Refund already processed for this order."
      });
    }
    let flwTxId = paymentRow?.data?.flwTransactionId || paymentRow?.data?.gatewayId || "";
    if (!flwTxId && effectiveRef) {
      const lookController = new AbortController();
      const lookTimeout = setTimeout(() => lookController.abort(), 8e3);
      try {
        const lookRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(effectiveRef)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${flwSecret}`, "Content-Type": "application/json" },
            signal: lookController.signal
          }
        );
        const lookData = await lookRes.json().catch(() => ({}));
        if (lookRes.ok && lookData?.status === "success" && lookData?.data?.id) {
          flwTxId = String(lookData.data.id);
        }
      } catch {
      } finally {
        clearTimeout(lookTimeout);
      }
    }
    if (!flwTxId) {
      return res.status(400).json({
        status: false,
        message: "Cannot execute Flutterwave refund: missing verified Flutterwave transaction ID for this reference."
      });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    let refundRes;
    let refundData;
    try {
      refundRes = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(flwTxId))}/refund`, {
        method: "POST",
        headers: { Authorization: `Bearer ${flwSecret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...amountKobo ? { amount: koboToNaira(Number(amountKobo)) } : {},
          comments: reason || "Customer refund approved by Shop It Admin"
        }),
        signal: controller.signal
      });
      refundData = await refundRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }
    if (!refundRes.ok || refundData?.status !== "success") {
      return res.status(502).json({ status: false, message: refundData?.message || "Flutterwave refund call failed." });
    }
    await withTransaction(async (client) => {
      const orderRes = await client.query(
        "SELECT * FROM shopit_orders WHERE payment_reference = $1 OR id = $2 FOR UPDATE",
        [effectiveRef, targetOrder?.id || orderId || ""]
      );
      if (orderRes.rows.length > 0) {
        const order = orderRes.rows[0];
        if (order.status !== "refunded") {
          const prevStatus = order.status;
          await restoreOrderStockInTx(client, order);
          await client.query(
            `UPDATE shopit_orders
             SET status = 'refunded', stock_reserved = false, auto_release_at = NULL,
                 notes = COALESCE(notes || ' | ', '') || $1, updated_at = NOW()
             WHERE id = $2`,
            [`Refunded: ${reason || "Approved by Admin"}`, order.id]
          );
          await client.query(
            `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
             VALUES ($1, $2, $3, 'refunded', $4, $5, NOW())`,
            [
              `osh_ref_${Date.now()}_${crypto12.randomBytes(3).toString("hex")}`,
              order.id,
              prevStatus,
              user.email,
              `Refund processed via Flutterwave: ${reason || "Admin approval"}`
            ]
          );
          const items = Array.isArray(order.items) ? order.items : [];
          const sellerTotalsKobo = {};
          for (const item of items) {
            if (item.sellerId) {
              const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
              const sellerUnitKobo = Number(item.sellerPriceKobo) || nairaToKobo(item.sellerPrice);
              sellerTotalsKobo[item.sellerId] = (sellerTotalsKobo[item.sellerId] || 0) + sellerUnitKobo * qty;
            }
          }
          for (const [sId, sellerRefundKobo] of Object.entries(sellerTotalsKobo)) {
            const wRes = await client.query(
              "SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
              [sId]
            );
            if (wRes.rows.length > 0) {
              const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || "0", 10);
              const newPending = Math.max(0, currentPending - sellerRefundKobo);
              const idempotencyKey = `refund:${order.id}:${sId}`;
              const ledgerIns = await client.query(
                `INSERT INTO shopit_ledger_entries (
                  id, wallet_id, order_id, type, balance_type, status,
                  amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
                ) VALUES ($1, $2, $3, 'refund', 'pending', 'completed', $4, 0, $5, $6, $7, $8, NOW())
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id`,
                [
                  `LEDGER-REF-${order.id}-${sId.slice(-6)}`,
                  sId,
                  order.id,
                  sellerRefundKobo,
                  newPending,
                  `Refund deducted from pending escrow for Order #${order.id}`,
                  effectiveRef || order.id,
                  idempotencyKey
                ]
              );
              if (ledgerIns.rows.length > 0) {
                await client.query(
                  "UPDATE shopit_wallets SET pending_balance_kobo = $1, updated_at = NOW() WHERE seller_id = $2",
                  [newPending, sId]
                );
              }
            }
          }
        }
      }
      if (effectiveRef) {
        let existingPayData = {};
        if (paymentRow?.data) {
          existingPayData = typeof paymentRow.data === "string" ? (() => {
            try {
              return JSON.parse(paymentRow.data);
            } catch {
              return {};
            }
          })() : typeof paymentRow.data === "object" ? paymentRow.data : {};
        }
        const mergedPayData = {
          ...existingPayData,
          refundId: refundData?.data?.id,
          flwTransactionId: flwTxId
        };
        await client.query(
          `UPDATE shopit_payments
           SET status = 'refunded',
               data = $1,
               updated_at = NOW()
           WHERE reference = $2`,
          [JSON.stringify(mergedPayData), effectiveRef]
        );
      }
    });
    await logAuditEvent({
      action: "PAYMENT_REFUND_EXECUTED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "payment", id: effectiveRef || orderId },
      details: { amountKobo, reason, orderId: targetOrder?.id || orderId, flwTxId },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Refund processed atomically.", data: refundData.data });
  } catch (err) {
    console.error("[Refund Error]:", err.message);
    return res.status(500).json({ status: false, message: `Refund processing failed: ${err.message}` });
  }
});
router4.get("/payments/payments", requirePaymentsEnabled, requireFinance, async (_req, res) => {
  try {
    const payRes = await query("SELECT * FROM shopit_payments ORDER BY created_at DESC LIMIT 200");
    return res.json({ status: true, payments: payRes.rows });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.get("/payments/events", requirePaymentsEnabled, requireAdmin, async (_req, res) => {
  try {
    const payRes = await query(
      "SELECT reference, order_id, amount_kobo, channel, status, webhook_received, updated_at FROM shopit_payments WHERE webhook_received = true OR status = 'paid' ORDER BY updated_at DESC LIMIT 200"
    );
    const events = payRes.rows.map((r) => ({
      ...r,
      amount_naira: koboToNaira(parseInt(String(r.amount_kobo || "0"), 10))
    }));
    return res.json({ status: true, events, processedCount: events.length });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
var withdrawalLocks = /* @__PURE__ */ new Map();
async function withSellerWithdrawalLock(sellerKey, fn) {
  const prev = withdrawalLocks.get(sellerKey) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  withdrawalLocks.set(sellerKey, prev.then(() => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (withdrawalLocks.get(sellerKey) === current) {
      withdrawalLocks.delete(sellerKey);
    }
  }
}
__name(withSellerWithdrawalLock, "withSellerWithdrawalLock");
router4.post("/payments/transfer", requirePayoutsEnabled, requireAuth, async (req, res) => {
  const user = req.user;
  const { amount, payoutAccountId, otpCode, sellerId } = req.body;
  const targetSellerId = sellerId ? String(sellerId).trim() : user.sellerId || user.userId;
  const ownsSeller = targetSellerId === user.userId || user.sellerId && targetSellerId === user.sellerId;
  if (!ownsSeller && user.role !== "admin") {
    return res.status(403).json({ status: false, message: "Forbidden: you can only withdraw from your own wallet." });
  }
  const flwSecret = getFlwSecretKey();
  if (!flwSecret) {
    return res.status(503).json({ status: false, message: "Payout gateway secret is not configured." });
  }
  const amountNum = Math.floor(Number(amount) || 0);
  if (amountNum < 1e3 || amountNum > 3e5) {
    return res.status(400).json({ status: false, message: "Withdrawal amount must be between \u20A61,000 and \u20A6300,000." });
  }
  if (!payoutAccountId) {
    return res.status(400).json({ status: false, message: "A saved payoutAccountId is required." });
  }
  if (!otpCode) {
    return res.status(400).json({ status: false, message: "Withdrawal authorization OTP is required." });
  }
  try {
    await runLazyPendingOrderExpiry();
    const otpCheck = await verifyAndConsumeOtp(user.email, "withdrawal", String(otpCode).trim());
    if (!otpCheck.success) {
      return res.status(400).json({ status: false, message: otpCheck.error || "Invalid or expired withdrawal OTP." });
    }
    const fee = 0;
    const amountKobo = amountNum * 100;
    const feeKobo = 0;
    const totalDeductionKobo = amountKobo;
    const transferCode = `TRF_${Date.now()}_${crypto12.randomBytes(4).toString("hex").toUpperCase()}`;
    const debitState = await withSellerWithdrawalLock(
      targetSellerId,
      () => withTransaction(async (client) => {
        const sellerRes = await client.query("SELECT * FROM shopit_sellers WHERE id = $1 OR user_id = $1", [
          targetSellerId
        ]);
        if (sellerRes.rows.length === 0) {
          throw Object.assign(new Error("Registered artisan profile not found."), { statusCode: 403 });
        }
        const seller = sellerRes.rows[0];
        if (seller.verification_status !== "verified" && seller.verification_status !== "approved") {
          throw Object.assign(new Error("NIN identity verification is required before withdrawing earnings."), {
            statusCode: 403
          });
        }
        const userAgeRes = await client.query("SELECT age FROM shopit_users WHERE id = $1 OR id = $2 LIMIT 1", [
          seller.user_id || targetSellerId,
          user.userId
        ]);
        const parsedAge = userAgeRes.rows[0]?.age !== null && userAgeRes.rows[0]?.age !== void 0 ? Number(userAgeRes.rows[0].age) : null;
        const isMinorSeller = Boolean(seller.under_18) || parsedAge !== null && parsedAge < 18;
        const wRes = await client.query("SELECT * FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE", [seller.id]);
        if (wRes.rows.length === 0) {
          throw Object.assign(new Error("Seller wallet not found."), { statusCode: 404 });
        }
        const wallet = wRes.rows[0];
        if (wallet.is_frozen) {
          throw Object.assign(new Error(`Wallet is frozen: ${wallet.freeze_reason || "Security review"}`), {
            statusCode: 403
          });
        }
        const payoutAccounts = Array.isArray(wallet.payout_accounts) ? wallet.payout_accounts : [];
        const account = payoutAccounts.find((a) => a.id === payoutAccountId);
        if (!account || !account.bankCode || !account.accountNumber) {
          throw Object.assign(new Error("Valid saved payout account with bank code not found."), { statusCode: 400 });
        }
        if (isMinorSeller && account.adminApproved !== true) {
          throw Object.assign(
            new Error("Under-18 seller guardian payout account requires one-time Admin approval before withdrawing."),
            { statusCode: 403 }
          );
        }
        if (account.coolingPeriodEndsAt && Date.now() < new Date(account.coolingPeriodEndsAt).getTime()) {
          const hoursRemaining = Math.max(
            1,
            Math.ceil((new Date(account.coolingPeriodEndsAt).getTime() - Date.now()) / (1e3 * 60 * 60))
          );
          throw Object.assign(
            new Error(`Payout account is in 24h security cooling period (${hoursRemaining}h remaining).`),
            { statusCode: 403 }
          );
        }
        const dailyCapKobo = isMinorSeller ? 25e5 : 3e7;
        const dailyCapNaira = isMinorSeller ? "\u20A625,000" : "\u20A6300,000";
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
        const dailyRes = await client.query(
          `SELECT COALESCE(SUM(amount_kobo), 0) AS daily_kobo
           FROM shopit_payouts
           WHERE seller_id = $1 AND status IN ('pending', 'processing', 'success') AND created_at >= $2`,
          [seller.id, dayAgo]
        );
        const dailyUsedKobo = parseInt(String(dailyRes.rows[0]?.daily_kobo || "0"), 10);
        if (dailyUsedKobo + amountKobo > dailyCapKobo) {
          throw Object.assign(
            new Error(
              isMinorSeller ? `Under-18 daily withdrawal limit of ${dailyCapNaira} exceeded.` : `Daily withdrawal limit of ${dailyCapNaira} exceeded.`
            ),
            { statusCode: 400 }
          );
        }
        const availableKobo = parseInt(String(wallet.available_balance_kobo || "0"), 10);
        if (availableKobo < totalDeductionKobo) {
          throw Object.assign(new Error("Insufficient Available balance for withdrawal and fee."), { statusCode: 400 });
        }
        const newAvailableKobo = availableKobo - totalDeductionKobo;
        const newWithdrawnKobo = parseInt(String(wallet.total_withdrawn_kobo || "0"), 10) + amountKobo;
        const updRes = await client.query(
          `UPDATE shopit_wallets
           SET available_balance_kobo = $1,
               total_withdrawn_kobo = $2, updated_at = NOW()
           WHERE seller_id = $3 AND available_balance_kobo >= $4`,
          [
            newAvailableKobo,
            newWithdrawnKobo,
            seller.id,
            totalDeductionKobo
          ]
        );
        if (updRes.rowCount === 0) {
          throw Object.assign(new Error("Insufficient Available balance (concurrent withdrawal blocked)."), {
            statusCode: 400
          });
        }
        const ledgerId = `LEDGER-WTD-${Date.now()}-${crypto12.randomBytes(3).toString("hex")}`;
        await client.query(
          `INSERT INTO shopit_ledger_entries (
          id, wallet_id, type, balance_type, status,
          amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
        ) VALUES ($1, $2, 'withdrawal', 'available', 'pending', $3, $4, $5, $6, $7, $8, NOW())`,
          [
            ledgerId,
            seller.id,
            amountKobo,
            feeKobo,
            newAvailableKobo,
            `Payout \xB7 ${account.bankName} (${account.accountNumber})`,
            transferCode,
            `withdrawal:${transferCode}`
          ]
        );
        await client.query(
          `INSERT INTO shopit_payouts (
          id, seller_id, amount_kobo, fee_kobo, total_deduction_kobo,
          bank_code, bank_name, account_number, account_name, transfer_code, reference, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW(), NOW())`,
          [
            transferCode,
            seller.id,
            amountKobo,
            feeKobo,
            totalDeductionKobo,
            String(account.bankCode),
            account.bankName,
            account.accountNumber,
            account.accountName || seller.shop_name,
            transferCode,
            transferCode
          ]
        );
        return { seller, account, newAvailableKobo };
      })
    );
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12e3);
      let transRes;
      let transData;
      try {
        transRes = await fetch("https://api.flutterwave.com/v3/transfers", {
          method: "POST",
          headers: { Authorization: `Bearer ${flwSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            account_bank: String(debitState.account.bankCode),
            account_number: debitState.account.accountNumber,
            amount: amountNum,
            currency: "NGN",
            narration: `Shop It Withdrawal - ${debitState.seller.shop_name}`,
            reference: transferCode,
            debit_currency: "NGN"
          }),
          signal: controller.signal
        });
        transData = await transRes.json().catch(() => ({}));
      } finally {
        clearTimeout(timeout);
      }
      if (!transRes.ok || transData?.status !== "success") {
        throw new Error(transData?.message || "Flutterwave transfer rejected.");
      }
      await query(
        "UPDATE shopit_payouts SET status = 'processing', transfer_code = $1, flw_transfer_id = $2, provider_response = $3, updated_at = NOW() WHERE id = $4",
        [
          transData.data?.reference || transferCode,
          transData.data?.id ? String(transData.data.id) : null,
          JSON.stringify(transData.data || {}),
          transferCode
        ]
      );
    } catch (gatewayErr) {
      await withTransaction(async (client) => {
        const wRes = await client.query(
          "SELECT available_balance_kobo, total_withdrawn_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE",
          [debitState.seller.id]
        );
        if (wRes.rows.length > 0) {
          const curAvail = parseInt(String(wRes.rows[0].available_balance_kobo || "0"), 10);
          const curWtd = parseInt(String(wRes.rows[0].total_withdrawn_kobo || "0"), 10);
          const restoredAvail = curAvail + totalDeductionKobo;
          const restoredWtd = Math.max(0, curWtd - amountKobo);
          await client.query(
            `UPDATE shopit_wallets
             SET available_balance_kobo = $1,
                 total_withdrawn_kobo = $2, updated_at = NOW()
             WHERE seller_id = $3`,
            [restoredAvail, restoredWtd, debitState.seller.id]
          );
          await client.query(
            `INSERT INTO shopit_ledger_entries (
              id, wallet_id, type, balance_type, status,
              amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
            ) VALUES ($1, $2, 'refund', 'available', 'completed', $3, 0, $4, $5, $6, $7, NOW())
            ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              `LEDGER-WTD-REV-${Date.now()}-${crypto12.randomBytes(3).toString("hex")}`,
              debitState.seller.id,
              totalDeductionKobo,
              restoredAvail,
              `Failed payout reversal \xB7 ${transferCode}`,
              transferCode,
              `withdrawal_reversal:${transferCode}`
            ]
          );
        }
        await client.query("UPDATE shopit_payouts SET status = 'failed', updated_at = NOW() WHERE id = $1", [transferCode]);
      });
      return res.status(502).json({ status: false, message: `Payout failed and balance restored: ${gatewayErr.message}` });
    }
    if (amountNum >= 5e4) {
      await sendAdminAlert2(
        `withdrawal_alert_${transferCode}`,
        `High-Value Withdrawal Request (\u20A6${amountNum.toLocaleString()})`,
        `Artisan <strong>"${escapeHtml(debitState.seller.shop_name)}"</strong> withdrew <strong>\u20A6${amountNum.toLocaleString()}</strong> to ${escapeHtml(debitState.account.bankName)} ending ${escapeHtml(String(debitState.account.accountNumber).slice(-4))}.`
      );
    }
    await logAuditEvent({
      action: "SELLER_WITHDRAWAL_DISPATCHED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "wallet", id: debitState.seller.id },
      details: { amount: amountNum, fee, transferCode, bankName: debitState.account.bankName },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      transferCode,
      amount: amountNum,
      fee,
      bankName: debitState.account.bankName,
      accountNumber: debitState.account.accountNumber,
      message: `Transfer of \u20A6${amountNum.toLocaleString()} initiated to ${debitState.account.bankName}. Ref: ${transferCode}`
    });
  } catch (err) {
    const code = err?.statusCode || 500;
    if (code >= 500) console.error("[Withdrawal Error]:", err.message);
    return res.status(code).json({ status: false, message: err.message || "Withdrawal failed." });
  }
});
router4.post("/email/send", requireAdmin, async (req, res) => {
  try {
    const { to, template, data, toName } = req.body;
    if (!to || !template) {
      return res.status(400).json({ status: false, message: 'Recipient "to" and allowed "template" key are required.' });
    }
    if (!VALID_EMAIL_TEMPLATES.has(template)) {
      return res.status(400).json({ status: false, message: "Unsupported email template." });
    }
    const cleanEmail = String(to).trim().toLowerCase();
    const rendered = renderTransactionalEmail(template, data || {});
    const sent = await sendBrevoDirect(cleanEmail, rendered.subject, rendered.text, rendered.html, toName || data?.name);
    await logAuditEvent({
      action: "ADMIN_EMAIL_SENT",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "email", id: cleanEmail },
      details: { template, dispatched: sent, subject: rendered.subject },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, dispatched: sent, subject: rendered.subject });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Internal server error dispatching email." });
  }
});
router4.post("/support/contact", async (req, res) => {
  try {
    const rl = await checkAndRecordRateLimit(`support:${req.ip || "unknown"}`, 5, 15 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: "Too many support messages. Please try again later." });
    }
    const { name, email, category, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ status: false, message: "Name, email, and message are required." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ status: false, message: "Please enter a valid email address." });
    }
    const cleanName = String(name).trim().slice(0, 120);
    const cleanCat = String(category || "General Question").trim().slice(0, 80);
    const cleanMsg = String(message).trim().slice(0, 3e3);
    const htmlBody = `<div style="font-family:sans-serif;padding:20px;">
      <h2>New Support Request</h2>
      <p><strong>From:</strong> ${escapeHtml(cleanName)} (${escapeHtml(cleanEmail)})</p>
      <p><strong>Category:</strong> ${escapeHtml(cleanCat)}</p>
      <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin-top:12px;">
        ${escapeHtml(cleanMsg).replace(/\n/g, "<br/>")}
      </div>
    </div>`;
    await sendBrevoDirect(
      "shopitverified@gmail.com",
      `[Shop It Help] ${cleanCat} from ${cleanName}`,
      `Support request from ${cleanName} (${cleanEmail})
Category: ${cleanCat}

${cleanMsg}`,
      htmlBody,
      "Shop It Support"
    );
    await logAuditEvent({
      action: "SUPPORT_CONTACT_SUBMITTED",
      actor: { id: cleanEmail, email: cleanEmail, role: "visitor" },
      target: { type: "support", id: cleanCat },
      details: { name: cleanName, category: cleanCat, preview: cleanMsg.slice(0, 150) },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: "Support inquiry sent." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Failed to submit contact request." });
  }
});
router4.post("/auth/send-otp", async (req, res) => {
  try {
    const { email, purpose, deviceId, metadata } = req.body;
    if (!email || !purpose) {
      return res.status(400).json({ status: false, message: "email and purpose are required" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPurpose = String(purpose).trim();
    if (cleanPurpose === "withdrawal" || cleanPurpose === "payout_account") {
      const token = extractToken(req);
      const session = token ? await getSession(token) : null;
      if (!session) {
        return res.status(401).json({ status: false, message: "Authentication required to request payout verification code." });
      }
      if (session.email.toLowerCase() !== cleanEmail && session.role !== "admin") {
        return res.status(403).json({ status: false, message: "You can only request payout OTPs for your own email." });
      }
    }
    const ipRl = await checkAndRecordRateLimit(`otp_ip:${req.ip || "unknown"}`, 25, 15 * 60 * 1e3);
    if (!ipRl.allowed) {
      return res.status(429).json({
        status: false,
        error: "RATE_LIMITED",
        message: "Too many verification code requests. Please try again in a few minutes.",
        waitSeconds: ipRl.retryAfterSeconds || 60
      });
    }
    const cooldownCheck = await checkResendCooldown(cleanEmail, cleanPurpose);
    if (!cooldownCheck.allowed) {
      return res.status(429).json({
        status: false,
        error: "OTP_COOLDOWN",
        message: `A code was just sent. Please wait ${cooldownCheck.waitSeconds}s before requesting another code.`,
        waitSeconds: cooldownCheck.waitSeconds
      });
    }
    const rateCheck = await checkRateLimit(cleanEmail, deviceId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        status: false,
        error: "RATE_LIMITED",
        message: rateCheck.reason,
        waitSeconds: 60
      });
    }
    if (cleanPurpose === "password_reset") {
      const userCheck = await query("SELECT id, is_verified_email FROM shopit_users WHERE LOWER(email) = LOWER($1)", [
        cleanEmail
      ]);
      if (userCheck.rows.length === 0) {
        await recordRateLimit(cleanEmail, deviceId);
        return res.json({
          status: true,
          message: "If an account with this email exists, a 6-digit verification code has been sent."
        });
      }
    }
    const code = String(crypto12.randomInt(1e5, 1e6));
    const codeHash = hashOtp(code);
    await saveHashedOtp(cleanEmail, cleanPurpose, codeHash, metadata);
    await recordRateLimit(cleanEmail, deviceId);
    const templateMap = {
      signup: "signup_code",
      new_device_login: "new_device_login",
      password_reset: "password_reset",
      withdrawal: "withdrawal_code",
      payout_account: "new_payout_account_code",
      email_change: "email_change"
    };
    const templateKey = templateMap[cleanPurpose] || "signup_code";
    const rendered = renderTransactionalEmail(templateKey, {
      code,
      email: cleanEmail,
      amount: metadata?.amount,
      bank_name: metadata?.bank_name,
      last4: metadata?.last4,
      ...metadata
    });
    const emailSent = await sendBrevoDirect(
      cleanEmail,
      rendered.subject,
      rendered.text,
      rendered.html,
      metadata?.name
    ).catch(() => false);
    if (IS_PROD2 && !emailSent && cleanPurpose !== "password_reset") {
      await deleteOtpRecord(cleanEmail, cleanPurpose).catch(() => {
      });
      return res.status(503).json({
        status: false,
        error: "EMAIL_SERVICE_UNAVAILABLE",
        message: "Verification email service could not deliver the code right now. Please try again shortly."
      });
    }
    await logAuditEvent({
      action: "OTP_REQUESTED",
      actor: { id: cleanEmail, email: cleanEmail, role: "user" },
      target: { type: "otp", id: cleanPurpose },
      details: { purpose: cleanPurpose, emailDelivered: Boolean(emailSent) },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      emailDelivered: Boolean(emailSent),
      message: cleanPurpose === "password_reset" ? "If an account with this email exists, a 6-digit verification code has been sent." : emailSent ? "A 6-digit verification code has been sent to your email." : "Verification code saved in database (email delivery skipped in local/non-production mode)."
    });
  } catch (err) {
    console.error("[Server Error in /api/auth/send-otp]", err.message);
    return res.status(500).json({ status: false, message: "Internal server error dispatching OTP." });
  }
});
router4.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, purpose, code } = req.body;
    if (!email || !purpose || !code) {
      return res.status(400).json({ status: false, message: "email, purpose, and code are required" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPurpose = String(purpose).trim();
    const inputCode = String(code).trim();
    const rl = await checkAndRecordRateLimit(`verify_otp:${req.ip || cleanEmail}`, 30, 15 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: "Too many attempts. Please try again later." });
    }
    const result = await verifyAndConsumeOtp(cleanEmail, cleanPurpose, inputCode);
    if (!result.success) {
      await logAuditEvent({
        action: "OTP_VERIFY_FAILED",
        actor: { id: cleanEmail, email: cleanEmail, role: "user" },
        target: { type: "otp", id: cleanPurpose },
        details: { purpose: cleanPurpose, reason: result.error || "Invalid code" },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      return res.status(400).json({
        status: false,
        message: result.error,
        attemptsRemaining: result.attemptsRemaining
      });
    }
    let signupVerificationToken;
    if (cleanPurpose === "signup" || cleanPurpose === "email_verification") {
      signupVerificationToken = await issueSignupVerificationToken(cleanEmail);
      await query("UPDATE shopit_users SET is_verified_email = true, updated_at = NOW() WHERE LOWER(email) = LOWER($1)", [
        cleanEmail
      ]).catch(() => {
      });
    }
    await logAuditEvent({
      action: "OTP_VERIFIED",
      actor: { id: cleanEmail, email: cleanEmail, role: "user" },
      target: { type: "otp", id: cleanPurpose },
      details: { purpose: cleanPurpose },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      signupVerificationToken,
      message: "Verification successful."
    });
  } catch (err) {
    console.error("[Server Error in /api/auth/verify-otp]", err.message);
    return res.status(500).json({ status: false, message: "Internal server error verifying OTP." });
  }
});
router4.post("/reports", optionalAuth, async (req, res) => {
  try {
    const rl = await checkAndRecordRateLimit(`reports:${req.ip || "unknown"}`, 10, 15 * 60 * 1e3);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: "Too many report submissions. Please wait a bit." });
    }
    const { targetType, targetId, targetTitle, reporterEmail, reason, details } = req.body;
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ status: false, message: "targetType, targetId, and reason are required" });
    }
    const reportId = `REP_${Date.now()}_${crypto12.randomInt(1e3, 1e4)}`;
    const resolvedEmail = req.user?.email || reporterEmail || void 0;
    let finalDetails = String(details || "").trim();
    if (String(targetType) === "chat" && req.user) {
      try {
        const convRes = await query(
          "SELECT id, buyer_id, seller_id FROM shopit_chat_conversations WHERE id = $1 LIMIT 1",
          [String(targetId).trim()]
        );
        const conv = convRes.rows[0];
        const isParticipant = conv && (conv.buyer_id === req.user.userId || conv.seller_id === req.user.userId || req.user.sellerId && conv.seller_id === req.user.sellerId || req.user.role === "admin" || String(req.user.role) === "moderator");
        if (isParticipant) {
          const msgRes = await query(
            `SELECT sender_id, sender_masked_name, sender_role, content, attachment, created_at
             FROM shopit_chat_messages
             WHERE conversation_id = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [conv.id]
          );
          if (msgRes.rows.length > 0) {
            const senderIds = Array.from(new Set(msgRes.rows.map((m) => m.sender_id).filter(Boolean).map(String)));
            const senderNameMap = /* @__PURE__ */ new Map();
            if (senderIds.length > 0) {
              const placeholders = senderIds.map((_, idx) => `$${idx + 1}`).join(", ");
              const uRes = await query(
                `SELECT id, name, display_name FROM shopit_users WHERE id IN (${placeholders})`,
                senderIds
              );
              for (const u of uRes.rows) {
                const first = String(u.name || "").trim().split(/\s+/)[0] || "";
                const resolved = String(u.display_name || first || "").trim();
                if (resolved) senderNameMap.set(String(u.id), resolved);
              }
            }
            const excerpt = msgRes.rows.slice().reverse().map((m) => {
              const who = m.sender_id && senderNameMap.get(String(m.sender_id)) || m.sender_masked_name || m.sender_role || "User";
              const att = typeof m.attachment === "string" ? (() => {
                try {
                  return JSON.parse(m.attachment);
                } catch {
                  return null;
                }
              })() : m.attachment;
              const attNote = att?.filename ? ` [Attachment: ${att.filename} (${att.fileId || ""})]` : "";
              return `[${who}]: ${String(m.content || "").slice(0, 140)}${attNote}`;
            }).join(" | ");
            finalDetails = `${finalDetails ? `${finalDetails}

` : ""}Recent Chat Context: ${excerpt}`;
          }
        }
      } catch {
      }
    }
    const newReport = {
      id: reportId,
      targetType,
      targetId: String(targetId).slice(0, 120),
      targetTitle: String(targetTitle || "Marketplace Item / User").slice(0, 200),
      reporterEmail: resolvedEmail ? String(resolvedEmail).slice(0, 200) : void 0,
      reason: String(reason).slice(0, 200),
      details: finalDetails.slice(0, 2e3),
      status: "open",
      actionLogs: [
        {
          action: "Report Submitted",
          note: `Flagged for: ${String(reason).slice(0, 150)}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      ],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await saveReportRecord(newReport);
    await logAuditEvent({
      action: "REPORT_SUBMITTED",
      actor: {
        id: req.user?.userId || "visitor",
        email: newReport.reporterEmail || "anonymous@visitor",
        role: req.user?.role || "visitor"
      },
      target: { type: "report", id: reportId },
      details: {
        targetType: newReport.targetType,
        targetId: newReport.targetId,
        targetTitle: newReport.targetTitle,
        reason: newReport.reason
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    await sendAdminAlert2(
      `report_alert_${reportId}`,
      `Safety Report Filed: ${escapeHtml(String(targetType).toUpperCase())}`,
      `Target Type: <strong>${escapeHtml(targetType)}</strong><br/>
       Target: <strong>${escapeHtml(newReport.targetTitle)}</strong><br/>
       Reason: <strong>${escapeHtml(newReport.reason)}</strong><br/>
       Details: ${escapeHtml(newReport.details || "None provided")}<br/>
       Reporter: ${escapeHtml(newReport.reporterEmail || "Anonymous")}`
    );
    return res.json({ status: true, reportId, message: "Report received. Our moderation team will investigate promptly." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Internal server error filing report." });
  }
});
router4.get("/reports", requireModerator, async (_req, res) => {
  try {
    const reports = await getAllReportRecords();
    return res.json({ status: true, reports });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.patch("/reports/:id", requireModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actionNote } = req.body;
    if (!["open", "reviewing", "resolved"].includes(status)) {
      return res.status(400).json({ status: false, message: "Invalid status. Must be open, reviewing, or resolved." });
    }
    await updateReportStatus(id, status, actionNote);
    await logAuditEvent({
      action: "REPORT_STATUS_UPDATED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "report", id },
      details: { status, actionNote },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({ status: true, message: `Report status updated to ${status}.` });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
async function verifyWithNigerianIdentityApi(nin, fullName, dob) {
  const provider = getKycProvider();
  return provider.verifyNin({
    nin,
    fullName,
    dateOfBirth: dob
  });
}
__name(verifyWithNigerianIdentityApi, "verifyWithNigerianIdentityApi");
router4.post(
  "/sellers/verify/submit",
  requireAuth,
  requireOwnershipOrAdmin((req) => req.body?.sellerId || req.body?.userId || ""),
  async (req, res) => {
    try {
      const user = req.user;
      const { sellerId, ownerName, shopName, nin, idType, under18, guardianName, guardianConsent } = req.body;
      const targetId = sellerId || user.sellerId || user.userId;
      if (!ownerName || !String(ownerName).trim()) {
        return res.status(400).json({ status: false, message: "Legal full name (ownerName) is required." });
      }
      const cleanNin = String(nin || "").trim().replace(/\D/g, "");
      if (cleanNin.length !== 11) {
        return res.status(400).json({ status: false, message: "A valid 11-digit NIN is required." });
      }
      const rlCheck = await checkAndRecordRateLimit(`verif_legacy:${targetId}`, 5, 24 * 60 * 60 * 1e3);
      if (!rlCheck.allowed) {
        return res.status(429).json({ status: false, message: "Too many verification attempts today. Please try again later." });
      }
      const ninLast4 = cleanNin.slice(-4);
      const reqId = `VERIF-${Date.now()}-${crypto12.randomBytes(2).toString("hex")}`;
      await query(
        `INSERT INTO shopit_verifications (
          id, seller_id, user_id, shop_name, owner_name, id_type, id_number_masked, full_nin_last4,
          status, under_18, guardian_name, notes, submitted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, NOW(), NOW(), NOW())`,
        [
          reqId,
          targetId,
          user.userId,
          shopName || null,
          ownerName || user.name,
          idType || "nin_slip",
          ninLast4 ? `***-***-${ninLast4}` : "****",
          ninLast4 || "****",
          Boolean(under18),
          guardianName || null,
          "Submitted for moderator review"
        ]
      );
      await query(
        `UPDATE shopit_sellers
         SET verification_status = 'pending', verified_legal_name = COALESCE($1, verified_legal_name),
             verified_nin_last4 = COALESCE($2, verified_nin_last4), under_18 = $3,
             guardian_name = $4, guardian_consent = $5, updated_at = NOW()
         WHERE id = $6 OR user_id = $6`,
        [ownerName || null, ninLast4 || null, Boolean(under18), guardianName || null, Boolean(guardianConsent), targetId]
      );
      await logAuditEvent({
        action: "NIN_SUBMITTED_FOR_ADMIN_REVIEW",
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: "seller", id: targetId },
        details: { requestId: reqId, shopName: shopName || null, maskedNin: `***-***-${ninLast4}` },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      return res.json({ status: true, requestId: reqId, message: "Verification submitted for review." });
    } catch (err) {
      return res.status(500).json({ status: false, message: err.message });
    }
  }
);
router4.post(
  "/verification/submit",
  requireAuth,
  requireOwnershipOrAdmin((req) => req.body?.sellerId || req.user?.sellerId || req.user?.userId || ""),
  async (req, res) => {
    try {
      const user = req.user;
      const {
        sellerId,
        shopName,
        fullName,
        dateOfBirth,
        nin,
        idDocumentType,
        idDocumentPhoto,
        selfiePhoto,
        livenessScore,
        under18,
        guardianFullName,
        guardianNin,
        guardianIdDocumentPhoto,
        guardianConsentSigned,
        ndpaConsentSigned
      } = req.body;
      const resolvedSellerId = sellerId || user.sellerId || user.userId;
      if (!fullName || !nin || !idDocumentPhoto || !selfiePhoto) {
        return res.status(400).json({
          status: false,
          message: "Full Name, NIN, ID Photo, and Live Selfie are mandatory."
        });
      }
      if (!ndpaConsentSigned) {
        return res.status(400).json({ status: false, message: "Data protection consent is required." });
      }
      const maxDocChars = 7 * 1024 * 1024;
      if (String(idDocumentPhoto).length > maxDocChars || String(selfiePhoto).length > maxDocChars || guardianIdDocumentPhoto && String(guardianIdDocumentPhoto).length > maxDocChars) {
        return res.status(413).json({ status: false, message: "Uploaded verification images exceed maximum 5MB limit." });
      }
      const cleanNin = String(nin).trim().replace(/\D/g, "");
      if (cleanNin.length !== 11) {
        return res.status(400).json({ status: false, message: "NIN must contain exactly 11 numeric digits." });
      }
      const rlCheck = await checkAndRecordRateLimit(`verif_submit:${resolvedSellerId}`, 5, 24 * 60 * 60 * 1e3);
      if (!rlCheck.allowed) {
        return res.status(429).json({
          status: false,
          code: "VERIFICATION_LOCKED",
          message: "Too many verification submissions today. Please wait 24 hours or contact Support."
        });
      }
      const ninDigest = hashNin(cleanNin);
      const dupRes = await query("SELECT seller_id FROM shopit_verifications WHERE id_hash = $1 LIMIT 1", [ninDigest]);
      if (dupRes.rows.length > 0 && dupRes.rows[0].seller_id !== resolvedSellerId) {
        await logAuditEvent({
          action: "DUPLICATE_NIN_FLAGGED",
          actor: { id: user.userId, email: user.email, role: user.role },
          target: { type: "seller", id: resolvedSellerId },
          ip: req.ip,
          userAgent: req.get("user-agent")
        });
        return res.status(409).json({
          status: false,
          code: "DUPLICATE_NIN",
          message: "This NIN is already associated with another Shop It account."
        });
      }
      if (under18) {
        if (!guardianFullName || !guardianNin || !guardianConsentSigned || !guardianIdDocumentPhoto) {
          return res.status(400).json({
            status: false,
            message: "Sellers under 18 require guardian full name, 11-digit NIN, guardian ID, and consent."
          });
        }
        if (String(guardianNin).replace(/\D/g, "").length !== 11) {
          return res.status(400).json({ status: false, message: "Guardian NIN must contain 11 numeric digits." });
        }
      }
      const idDocId = `doc_id_${resolvedSellerId}_${Date.now()}`;
      const selfieDocId = `doc_selfie_${resolvedSellerId}_${Date.now()}`;
      const guardianDocId = under18 ? `doc_guardian_${resolvedSellerId}_${Date.now()}` : void 0;
      const idDocUrl = `/api/verification/document/${encodeURIComponent(idDocId)}`;
      const selfieDocUrl = `/api/verification/document/${encodeURIComponent(selfieDocId)}`;
      const apiResult = await verifyWithNigerianIdentityApi(cleanNin, fullName, dateOfBirth);
      const finalStatus = apiResult.success && apiResult.status === "match" && (Number(livenessScore) || 0) >= 70 ? "verified" : "pending";
      const submissionId = `VERIF_${Date.now()}_${crypto12.randomBytes(3).toString("hex")}`;
      const fullNinLast4 = cleanNin.slice(-4);
      const maskedNin = `***-***-${fullNinLast4}`;
      await withTransaction(async (client) => {
        if (finalStatus === "pending") {
          await client.query(
            `INSERT INTO shopit_verification_documents (id, seller_id, doc_type, encrypted_data, created_at)
             VALUES ($1, $2, 'id_document', $3, NOW()), ($4, $2, 'selfie', $5, NOW())`,
            [
              idDocId,
              resolvedSellerId,
              encryptSensitiveData(String(idDocumentPhoto)),
              selfieDocId,
              encryptSensitiveData(String(selfiePhoto))
            ]
          );
          if (guardianDocId && guardianIdDocumentPhoto) {
            await client.query(
              `INSERT INTO shopit_verification_documents (id, seller_id, doc_type, encrypted_data, created_at)
               VALUES ($1, $2, 'guardian_id', $3, NOW())`,
              [guardianDocId, resolvedSellerId, encryptSensitiveData(String(guardianIdDocumentPhoto))]
            );
          }
        }
        await client.query(
          `INSERT INTO shopit_verifications (
            id, seller_id, user_id, shop_name, owner_name, id_type,
            id_number_masked, full_nin_last4, nin_last4, id_hash,
            document_url, selfie_url, under_18, guardian_name,
            status, notes, reviewed_by, reviewed_at, submitted_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW(), NOW())`,
          [
            submissionId,
            resolvedSellerId,
            user.userId,
            shopName || `${fullName}'s Crafts`,
            fullName.trim(),
            idDocumentType || "nin_slip",
            maskedNin,
            fullNinLast4,
            fullNinLast4,
            ninDigest,
            finalStatus === "pending" ? idDocUrl : "[Deleted after automated verification]",
            finalStatus === "pending" ? selfieDocUrl : "[Deleted after automated verification]",
            Boolean(under18),
            guardianFullName ? String(guardianFullName).trim() : null,
            finalStatus,
            `Submission via portal (${apiResult.provider}). Liveness: ${Math.round(Number(livenessScore) || 90)}%`,
            finalStatus === "verified" ? apiResult.provider : null,
            finalStatus === "verified" ? (/* @__PURE__ */ new Date()).toISOString() : null
          ]
        );
        await client.query(
          `UPDATE shopit_sellers
           SET verification_status = $1, is_verified_seller = $2, verified_legal_name = $3,
               verified_nin_last4 = $4,
               under_18 = COALESCE($5, under_18),
               guardian_name = COALESCE($6, guardian_name),
               guardian_consent = COALESCE($7, guardian_consent),
               verified_at = CASE WHEN $2 = true THEN NOW() ELSE verified_at END, updated_at = NOW()
           WHERE id = $8 OR user_id = $8`,
          [
            finalStatus,
            finalStatus === "verified",
            fullName.trim(),
            fullNinLast4,
            under18 !== void 0 ? Boolean(under18) : null,
            guardianFullName ? String(guardianFullName).trim() : null,
            under18 ? Boolean(guardianConsentSigned) : null,
            resolvedSellerId
          ]
        );
      });
      await logAuditEvent({
        action: finalStatus === "verified" ? "NIN_AUTO_VERIFIED" : "NIN_SUBMITTED_FOR_ADMIN_REVIEW",
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: "seller", id: resolvedSellerId },
        details: { submissionId, maskedNin, provider: apiResult.provider },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      await sendAdminAlert2(
        `verif_submission_${submissionId}`,
        `New Seller Identity Verification: ${escapeHtml(shopName || fullName)}`,
        `Artisan <strong>"${escapeHtml(shopName || fullName)}"</strong> (${escapeHtml(fullName)}) submitted verification.<br/>
         Status: <strong>${finalStatus === "verified" ? "Verified" : "Pending Moderator Review"}</strong><br/>
         Masked NIN: <strong>${escapeHtml(maskedNin)}</strong>`
      );
      return res.status(200).json({
        status: true,
        verificationId: submissionId,
        verificationStatus: finalStatus,
        maskedNin,
        ownerName: fullName,
        verifiedAt: finalStatus === "verified" ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
        message: finalStatus === "verified" ? "Identity verification succeeded. Your Verified Artisan badge is active!" : "Verification submitted successfully. Your documents have been queued for Trust & Safety review."
      });
    } catch (err) {
      console.error("Error in /api/verification/submit:", err.message);
      return res.status(500).json({ status: false, message: "Internal server error processing verification submission." });
    }
  }
);
router4.get(
  "/verification/status/:sellerId",
  requireAuth,
  requireOwnershipOrAdmin((req) => req.params.sellerId),
  async (req, res) => {
    try {
      const { sellerId } = req.params;
      const sellerRes = await query(
        `SELECT s.is_verified_seller, s.verification_status, s.verification_rejection_reason,
                s.verified_legal_name, s.verified_nin_last4, s.verified_at
         FROM shopit_sellers s
         WHERE s.id = $1 OR s.user_id = $1`,
        [sellerId]
      );
      const sellerRow = sellerRes.rows[0];
      const verifRes = await query(
        "SELECT status, rejection_reason, admin_notes FROM shopit_verifications WHERE seller_id = $1 OR user_id = $1 ORDER BY submitted_at DESC LIMIT 1",
        [sellerId]
      );
      const isVerified = Boolean(
        sellerRow?.is_verified_seller || sellerRow?.verification_status === "verified" || sellerRow?.verification_status === "approved" || verifRes.rows[0]?.status === "verified" || verifRes.rows[0]?.status === "approved"
      );
      const verifStatus = isVerified ? "verified" : verifRes.rows[0]?.status || sellerRow?.verification_status || "not_started";
      return res.json({
        status: true,
        verificationStatus: verifStatus,
        isVerified,
        maskedNin: sellerRow?.verified_nin_last4 ? `******${sellerRow.verified_nin_last4}` : void 0,
        ownerName: sellerRow?.verified_legal_name,
        verifiedAt: sellerRow?.verified_at,
        rejectionReason: sellerRow?.verification_rejection_reason || verifRes.rows[0]?.rejection_reason || verifRes.rows[0]?.admin_notes,
        isLocked: false
      });
    } catch (err) {
      return res.status(500).json({ status: false, message: "Database error retrieving verification status." });
    }
  }
);
router4.get("/verification/admin/queue", requireModerator, async (_req, res) => {
  try {
    const dbRes = await query(`
      SELECT v.*, s.shop_name as seller_shop_name, s.owner_name as seller_owner_name
      FROM shopit_verifications v
      LEFT JOIN shopit_sellers s ON (s.id = v.seller_id OR s.user_id = v.seller_id)
      ORDER BY v.submitted_at DESC
      LIMIT 100
    `);
    const auditRes = await query(
      "SELECT id, action, target_id, actor_email, details, created_at FROM shopit_audit_logs WHERE action LIKE 'NIN_%' OR action LIKE '%VERIF%' OR action LIKE '%NIN%' ORDER BY created_at DESC LIMIT 50"
    );
    const queue = dbRes.rows.map((row) => ({
      id: row.id,
      sellerId: row.seller_id,
      shopName: row.shop_name || row.seller_shop_name || "Artisan Shop",
      ownerName: row.owner_name || row.seller_owner_name || "Seller",
      idType: row.id_type || row.document_type || "nin_slip",
      fullNinLast4: row.id_number_masked || "****",
      idNumber: row.id_number_masked || "****",
      under18: Boolean(row.under_18),
      guardianName: row.guardian_name,
      status: row.status,
      rejectionReason: row.rejection_reason,
      adminNotes: row.admin_notes || row.notes,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at || row.created_at,
      idCardPhotoUrl: row.document_url || "",
      selfiePhotoUrl: row.selfie_url || ""
    }));
    return res.json({
      status: true,
      totalCount: queue.length,
      pendingCount: queue.filter((q) => q.status === "pending").length,
      queue,
      auditLogs: auditRes.rows
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.post("/verification/admin/review", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const sellerTarget = req.body.sellerId || req.body.requestId || req.body.targetId;
    const rawAction = req.body.action || req.body.decision;
    const reason = req.body.reason || req.body.rejectionReason;
    const reviewedBy = user.email;
    if (!sellerTarget) {
      return res.status(400).json({ status: false, message: "sellerId or requestId is required." });
    }
    const action = rawAction === "approved" ? "verified" : rawAction;
    if (!["verified", "rejected", "needs_resubmission"].includes(action)) {
      return res.status(400).json({ status: false, message: "Invalid action." });
    }
    const isVerified = action === "verified";
    await withTransaction(async (client) => {
      const sellerUpdate = await client.query(
        `UPDATE shopit_sellers
         SET is_verified_seller = $1, verification_status = $2,
             verified_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
             verification_rejection_reason = $3, updated_at = NOW()
         WHERE id = $4 OR user_id = $4 OR LOWER(email) = LOWER($4)`,
        [isVerified, action, isVerified ? null : reason || null, sellerTarget]
      );
      if (sellerUpdate.rowCount === 0) {
        await client.query(
          `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status, verified_at, created_at, updated_at)
           SELECT u.id, u.id, COALESCE(u.name || '''s Shop', 'Artisan Shop'), u.name, u.email, $1, $2, CASE WHEN $1 = true THEN NOW() ELSE NULL END, NOW(), NOW()
           FROM shopit_users u WHERE u.id = $3 OR LOWER(u.email) = LOWER($3)
           ON CONFLICT (id) DO UPDATE SET is_verified_seller = $1, verification_status = $2, updated_at = NOW()`,
          [isVerified, action, sellerTarget]
        );
      }
      await client.query(
        `UPDATE shopit_users
         SET role = CASE WHEN $1 = true AND role = 'buyer' THEN 'seller' ELSE role END, updated_at = NOW()
         WHERE id = $2 OR LOWER(email) = LOWER($2) OR id IN (SELECT user_id FROM shopit_sellers WHERE id = $2)`,
        [isVerified, sellerTarget]
      );
      await client.query(
        `UPDATE shopit_verifications
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
             rejection_reason = $3, admin_notes = $3, notes = $3,
             document_url = '[Deleted after review decision]',
             selfie_url = '[Deleted after review decision]',
             updated_at = NOW()
         WHERE seller_id = $4 OR user_id = $4 OR id = $4`,
        [action, reviewedBy, reason || null, sellerTarget]
      );
      await client.query(
        `DELETE FROM shopit_verification_documents
         WHERE seller_id = $1
            OR seller_id IN (SELECT seller_id FROM shopit_verifications WHERE id = $1 OR seller_id = $1 OR user_id = $1)
            OR seller_id IN (SELECT id FROM shopit_sellers WHERE id = $1 OR user_id = $1 OR LOWER(email) = LOWER($1))`,
        [sellerTarget]
      );
    });
    await logAuditEvent({
      action: `VERIFICATION_${action.toUpperCase()}`,
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "seller", id: sellerTarget },
      details: { reason, imagesPurgedImmediately: true },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      sellerId: sellerTarget,
      isVerifiedSeller: isVerified,
      verificationStatus: action,
      imagesDeletedImmediately: true,
      message: `Seller verification status updated to '${action}'. Uploaded ID/selfie images have been deleted immediately.`
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
});
router4.get("/verification/document/:docId", requireModerator, async (req, res) => {
  try {
    const user = req.user;
    const { docId } = req.params;
    const docRes = await query("SELECT seller_id, doc_type, encrypted_data FROM shopit_verification_documents WHERE id = $1", [docId]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Requested identity document was not found or was purged." });
    }
    const doc = docRes.rows[0];
    const plainData = decryptSensitiveData(doc.encrypted_data);
    await logAuditEvent({
      action: "KYC_DOCUMENT_ACCESSED",
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: "verification_document", id: docId },
      details: { sellerId: doc.seller_id, docType: doc.doc_type },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    if (plainData.startsWith("data:image/")) {
      const matches = plainData.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (matches) {
        res.setHeader("Content-Type", matches[1]);
        res.setHeader("Cache-Control", "no-store");
        return res.send(Buffer.from(matches[2], "base64"));
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.json({ status: true, docId, data: plainData });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Unable to retrieve document." });
  }
});
router4.post(
  "/verification/delete-data",
  requireAuth,
  requireOwnershipOrAdmin((req) => req.body?.sellerId || req.user?.sellerId || req.user?.userId || ""),
  async (req, res) => {
    try {
      const user = req.user;
      const sellerId = req.body?.sellerId || user.sellerId || user.userId;
      const { confirmationText } = req.body;
      if (confirmationText !== "PURGE_MY_IDENTITY_DATA") {
        return res.status(400).json({ status: false, message: 'Confirmation phrase "PURGE_MY_IDENTITY_DATA" required.' });
      }
      await withTransaction(async (client) => {
        await client.query("DELETE FROM shopit_verification_documents WHERE seller_id = $1", [sellerId]);
        await client.query(
          `UPDATE shopit_verifications
           SET document_url = '[Purged]', selfie_url = '[Purged]', id_hash = NULL, updated_at = NOW()
           WHERE seller_id = $1 OR user_id = $1`,
          [sellerId]
        );
      });
      await logAuditEvent({
        action: "NDPA_DATA_PURGED",
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: "seller", id: sellerId },
        ip: req.ip,
        userAgent: req.get("user-agent")
      });
      return res.json({ status: true, message: "Identification documents permanently purged." });
    } catch (err) {
      return res.status(500).json({ status: false, message: err.message });
    }
  }
);
router4.all(["/cron/daily", "/cron/escrow"], async (req, res) => {
  const rl = await checkAndRecordRateLimit(`cron_daily:${req.ip || "unknown"}`, 30, 60 * 1e3);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSeconds || 60));
    return res.status(429).json({ status: false, error: "RATE_LIMITED", message: "Too many cron triggers." });
  }
  const expired = await expireStalePendingOrders(50);
  const escrow = await processEscrowAutoRelease(50);
  const unshipped = await processUnshippedOrders(50);
  const reconciliation = await runDailyReconciliationCheck();
  const orphanCleanup = await fileStorage.cleanupOrphanedFiles();
  const dbStats = await getDatabaseHealthStats();
  await checkStorageThresholdAlert(dbStats.databaseSizeMb);
  const workCount = expired.expiredCount + escrow.releasedCount + unshipped.remindedCount + unshipped.refundedCount + expired.purgedDocsCount + orphanCleanup.deletedCount;
  if (workCount > 0 || !reconciliation.ok) {
    await logAuditEvent({
      action: "CRON_DAILY_PROCESSED",
      actor: { id: "cron", email: "system@shopit.ng", role: "system" },
      target: { type: "cron", id: "daily" },
      details: {
        expiredOrdersCount: expired.expiredCount,
        escrowReleasedCount: escrow.releasedCount,
        unshippedRemindedCount: unshipped.remindedCount,
        unshippedRefundedCount: unshipped.refundedCount,
        purgedDocsCount: expired.purgedDocsCount,
        cleanedOrphanFilesCount: orphanCleanup.deletedCount,
        databaseSizeMb: dbStats.databaseSizeMb,
        reconciliationOk: reconciliation.ok
      },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
  }
  return res.json({
    status: true,
    ok: true,
    processed: {
      expiredOrdersCount: expired.expiredCount,
      escrowReleasedCount: escrow.releasedCount,
      unshippedRemindedCount: unshipped.remindedCount,
      unshippedRefundedCount: unshipped.refundedCount,
      purgedDocsCount: expired.purgedDocsCount,
      cleanedOrphanFilesCount: orphanCleanup.deletedCount,
      databaseSizeMb: dbStats.databaseSizeMb,
      reconciliationOk: reconciliation.ok
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
router4.post("/coupons/validate", requireAuth, async (req, res) => {
  try {
    const cleanCode = String(req.body?.code || "").trim().toUpperCase();
    const subtotalNaira = Math.max(0, Number(req.body?.subtotal) || 0);
    if (!cleanCode) {
      return res.status(400).json({ status: false, message: "Promo code is required." });
    }
    const couponRes = await query("SELECT * FROM shopit_coupons WHERE UPPER(code) = $1 LIMIT 1", [cleanCode]);
    if (couponRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: "Invalid promo code." });
    }
    const coupon = couponRes.rows[0];
    if (!coupon.is_active) {
      return res.status(400).json({ status: false, message: "This promo code is no longer active." });
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ status: false, message: "This promo code has expired." });
    }
    if (coupon.max_uses !== null && coupon.max_uses !== void 0 && Number(coupon.current_uses || 0) >= Number(coupon.max_uses)) {
      return res.status(400).json({ status: false, message: "This promo code has reached its usage limit." });
    }
    const minOrderNaira = koboToNaira(parseInt(String(coupon.min_subtotal_kobo || "0"), 10));
    if (subtotalNaira < minOrderNaira) {
      return res.status(400).json({
        status: false,
        message: `This promo code requires a minimum item order of \u20A6${minOrderNaira.toLocaleString()}.`
      });
    }
    const discountAmount = koboToNaira(parseInt(String(coupon.discount_kobo || "0"), 10));
    await logAuditEvent({
      action: "COUPON_VALIDATED",
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: "coupon", id: coupon.code },
      details: { code: coupon.code, discountAmount, subtotalNaira },
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
    return res.json({
      status: true,
      coupon: {
        code: coupon.code,
        discountAmount,
        minOrder: minOrderNaira,
        description: `\u20A6${discountAmount.toLocaleString()} promo discount (${coupon.code})`
      }
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Unable to validate promo code." });
  }
});
app.use("/api", router4);
app.use("/", router4);
app.use("/api", (_req, res) => {
  return res.status(404).json({ status: false, message: "Not found" });
});
var config = {
  api: {
    bodyParser: false
  }
};
function handler2(req, res) {
  return app(req, res, () => {
    if (!res.headersSent) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: false, message: "Not found" }));
    }
  });
}
__name(handler2, "handler");
export {
  app,
  config,
  handler2 as default,
  sendAdminAlert2 as sendAdminAlert
};
