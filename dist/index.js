// src/rest.ts
import axios from "axios";

// src/problem.ts
class Problem extends Error {
  raw;
  type;
  title;
  detail;
  constructor(raw) {
    super();
    this.raw = raw;
    this.type = String(raw.type ?? "fsb:problem:unknown");
    this.title = String(raw.title ?? "Unknown Problem");
    this.detail = String(raw.detail ?? "An unknown error occurred");
  }
}

// src/rest.ts
var defaultOptions = {
  baseUrl: "https://api.freestuffbot.xyz/v2"
};
function handleError(err) {
  if (!axios.isAxiosError(err)) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("An unknown error occurred", { cause: err });
  }
  if (err.response) {
    if (err.response.data && typeof err.response.data === "object" && err.response.data.type && String(err.response.data.type).startsWith("fsb:problem:")) {
      throw new Problem(err.response.data);
    }
    throw new Problem({
      type: "fsb:problem:internal:api_error",
      title: "API Error",
      detail: `Received an error response from the API: ${err.response.status} - ${err.response.statusText}`,
      raw: err.response.data
    });
  } else if (err.request) {
    throw new Problem({
      type: "fsb:problem:internal:request_failed",
      title: "Request Failed",
      detail: `No response received from the server. Request details: ${JSON.stringify(err.request)}`
    });
  } else {
    throw new Problem({
      type: "fsb:problem:internal:request_setup_failed",
      title: "Request Setup Failed",
      detail: `An error occurred while setting up the request: ${err.message}`
    });
  }
}

class RestApiClient {
  client;
  constructor(token, options) {
    this.client = axios.create({
      baseURL: options?.baseUrl || defaultOptions.baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "freestuff-js/2.1.0 (https://docs.freestuffbot.xyz/libraries/node/)",
        "Content-Type": "application/json",
        "X-Set-Compatibility-Date": "2025-07-01"
      }
    });
  }
  getPing() {
    return this.client.get("/ping").then((res) => res.data).catch(handleError);
  }
  static = {
    getSchemas: () => this.client.get("/static/schemas").then((res) => res.data).catch(handleError),
    getSchema: (urn) => this.client.get(`/static/schemas/${urn}`).then((res) => res.data).catch(handleError),
    getProblems: () => this.client.get("/static/problems").then((res) => res.data).catch(handleError),
    getEvents: () => this.client.get("/static/events").then((res) => res.data).catch(handleError)
  };
}
// src/bitfield.ts
function createBitfield(from, model) {
  let local = from;
  const iterate = function* () {
    for (const item of Object.keys(model)) {
      if (local & model[item]) {
        yield item;
      }
    }
  };
  return {
    has: (item) => (local & model[item]) !== 0,
    add: (item) => void (local |= model[item]),
    remove: (item) => void (local &= ~model[item]),
    toggle: (item) => void (local ^= model[item]),
    getBits: () => local,
    toString: () => [...iterate()].join(", "),
    toArray: () => [...iterate()],
    size: () => [...iterate()].length,
    [Symbol.iterator]: () => iterate()
  };
}
// src/events.ts
import { EventEmitter } from "node:events";
var emitter = new EventEmitter;
function on(event, listener) {
  emitter.on(event, listener);
}
function once(event, listener) {
  emitter.once(event, listener);
}
function off(event, listener) {
  emitter.off(event, listener);
}
function emit(event) {
  emitter.emit(event.type, event);
}
// src/verifier.ts
import { createPublicKey, verify } from "node:crypto";

// src/parser.ts
var productFlags = {
  TRASH: 1 << 0,
  THIRDPARTY: 1 << 1,
  PERMANENT: 1 << 2,
  STAFF_PICK: 1 << 3,
  FIRSTPARTY_EXCLUSIVE: 1 << 4
};
var productUrlFlags = {
  ORIGINAL: 1 << 0,
  PROXIED: 1 << 1,
  TRACKING: 1 << 2,
  OPENS_IN_BROWSER: 1 << 3,
  OPENS_IN_CLIENT: 1 << 4
};
var productImageFlags = {
  PROXIED: 1 << 0,
  AR_WIDE: 1 << 1,
  AR_SQUARE: 1 << 2,
  AR_TALL: 1 << 3,
  TP_PROMO: 1 << 4,
  TP_LOGO: 1 << 5,
  TP_SHOWCASE: 1 << 6,
  TP_OTHER: 1 << 7,
  FT_WATERMARK: 1 << 8,
  FT_TAGS: 1 << 9
};
function parseProduct(product) {
  product.until = product.until ? new Date(product.until) : null;
  product.flags = createBitfield(product.flags, productFlags);
  product.urls.forEach((url) => url.flags = createBitfield(url.flags, productUrlFlags));
  product.images.forEach((image) => image.flags = createBitfield(image.flags, productImageFlags));
  return product;
}
function parseResolvedAnnouncement(announcement) {
  announcement.resolvedProducts = announcement.resolvedProducts.map(parseProduct);
  return announcement;
}
var epochBegin = new Date("2025-01-01T00:00:00Z").getTime();
function parseEpochTimestamp(timestamp) {
  const asNumber = Number(timestamp);
  if (isNaN(asNumber) || asNumber < 0) {
    return null;
  }
  return new Date(epochBegin + asNumber * 1000);
}
function parseEvent(event) {
  if (event.type === "fsb:event:product_updated") {
    event.data = parseProduct(event.data);
  } else if (event.type === "fsb:event:announcement_created") {
    event.data = parseResolvedAnnouncement(event.data);
  }
  event.timestamp = new Date(String(event.timestamp));
  return event;
}

// src/verifier.ts
function newSignedMessageVerifier(options) {
  const key = typeof options.publicKey === "string" ? createPublicKey({
    key: Buffer.from(options.publicKey, "base64"),
    format: "der",
    type: "spki"
  }) : options.publicKey;
  const maxMessageAge = options.maxMessageAge ?? 5 * 60 * 1000;
  const skipDuplicateCheck = options.skipDuplicateCheck ?? false;
  const skipTimestampCheck = options.skipTimestampCheck ?? false;
  const storedMessageIds = new Set;
  const deleteMessageIdsAfter = maxMessageAge + 1 * 60 * 1000;
  const isDateOlderThanMaxAge = (date) => {
    const now = new Date;
    return now.getTime() - date.getTime() > maxMessageAge;
  };
  return (input) => {
    if (!input.data || !input.signature || !input.messageId || !input.timestamp) {
      return {
        success: false,
        status: "missing-parameters",
        payloadJson: null,
        payloadRaw: null
      };
    }
    const asDate = parseEpochTimestamp(input.timestamp);
    if (!skipTimestampCheck && (!asDate || isNaN(asDate.getTime()) || isDateOlderThanMaxAge(asDate))) {
      return {
        success: false,
        status: "invalid-timestamp",
        payloadJson: null,
        payloadRaw: null
      };
    }
    if (!skipDuplicateCheck && storedMessageIds.has(input.messageId)) {
      return {
        success: false,
        status: "duplicate",
        payloadJson: null,
        payloadRaw: null
      };
    }
    if (skipDuplicateCheck) {
      storedMessageIds.add(input.messageId);
      setTimeout(() => {
        storedMessageIds.delete(input.messageId);
      }, deleteMessageIdsAfter);
    }
    const [version, sigB64] = String(input.signature).split(",");
    if (version !== "v1a") {
      return {
        success: false,
        status: "unsupported-algorithm",
        payloadJson: null,
        payloadRaw: null
      };
    }
    const sigBuff = Buffer.from(sigB64, "base64");
    const contentBuff = Buffer.from(`${input.messageId}.${input.timestamp}.${input.data.toString()}`, "utf8");
    const valid = verify(null, new Uint8Array(contentBuff), key, sigBuff);
    if (!valid) {
      return {
        success: false,
        status: "invalid-signature",
        payloadJson: null,
        payloadRaw: null
      };
    }
    return {
      success: true,
      status: "valid",
      payloadJson: input.data.toString() ? JSON.parse(input.data.toString()) : null,
      payloadRaw: input.data
    };
  };
}
// src/webhooks.ts
import express, { raw } from "express";
function createExpressHandler(pubkey, options) {
  const verifier = newSignedMessageVerifier({
    publicKey: pubkey,
    ...options ?? {}
  });
  const rawParser = raw({ type: "*/*" });
  return (req, res, next) => {
    rawParser(req, res, (err) => {
      res.header("X-Set-Compatibility-Date", "2025-07-01");
      res.header("X-Client-Library", "freestuff-js/2.1.0 (https://docs.freestuffbot.xyz/libraries/node/)");
      if (err) {
        return void res.status(500).send("Error parsing request body");
      }
      if (!req.body) {
        return void res.status(400).send("Missing body");
      }
      if (!Buffer.isBuffer(req.body)) {
        console.warn("Webhook body is not a Buffer! Please move any mentions of `use(express.json())` after the webhook handler.");
        return void res.status(500).send("Invalid server configuration");
      }
      const result = verifier({
        data: req.body,
        signature: String(req.headers["webhook-signature"]),
        messageId: String(req.headers["webhook-id"]),
        timestamp: String(req.headers["webhook-timestamp"])
      });
      if (options?.debug) {
        console.log("in>", {
          data: req.body,
          signature: String(req.headers["webhook-signature"]),
          messageId: String(req.headers["webhook-id"]),
          timestamp: String(req.headers["webhook-timestamp"])
        });
        console.log("out>", result);
      }
      if (!result.success) {
        return void res.status(400).send(`Verification failed: ${result.status}`);
      }
      const compatibilityDate = req.headers["x-compatibility-date"];
      if (compatibilityDate !== "2025-07-01") {
        return void res.status(400).send("Incompatible compatibility date");
      }
      res.status(204).end();
      if (!result.payloadJson.type || !String(result.payloadJson.type).startsWith("fsb:event:")) {
        console.warn(`Received a correctly signed but unsupported payload.`);
        console.log(result.payloadJson);
        return;
      }
      emit(parseEvent(result.payloadJson));
    });
  };
}
function createExpressServer(options) {
  const handler = createExpressHandler(options.publicKey, options);
  const app = express();
  if (options.route) {
    app.use(options.route, handler);
  } else {
    app.use(handler);
  }
  const { promise, resolve } = Promise.withResolvers();
  const port = options.port ?? 3000;
  app.listen(port, () => resolve({ app, port }));
  return promise;
}
export {
  once,
  on,
  off,
  newSignedMessageVerifier,
  emit,
  createExpressServer,
  createExpressHandler,
  createBitfield,
  RestApiClient,
  Problem
};

//# debugId=1C719AA061DC2A0264756E2164756E21
//# sourceMappingURL=index.js.map
