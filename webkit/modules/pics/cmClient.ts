import { fetchViaBackend } from '../../shared/ipc';

const PROTO_MASK = 0x80000000;
const EMSG_MULTI = 1;
const EMSG_CLIENT_LOGON = 5514;
const EMSG_CLIENT_LOGON_RESPONSE = 751;
const EMSG_PICS_PRODUCT_INFO_REQUEST = 8903;
const EMSG_PICS_PRODUCT_INFO_RESPONSE = 8904;
const EMSG_PICS_ACCESS_TOKEN_REQUEST = 8905;
const EMSG_PICS_ACCESS_TOKEN_RESPONSE = 8906;

const ANON_STEAM_ID = (BigInt(1) << BigInt(56)) | (BigInt(10) << BigInt(52)); // [A:1:0:0]

interface ProtoField {
  field: number;
  wireType: number;
  varint?: bigint;
  fixed64?: bigint;
  fixed32?: number;
  bytes?: Uint8Array;
}

function writeVarint(out: number[], value: number | bigint): void {
  let v = typeof value === 'bigint' ? value : BigInt(value);
  if (v < BigInt(0)) v = BigInt.asUintN(64, v);
  while (v >= BigInt(0x80)) {
    out.push(Number((v & BigInt(0x7f)) | BigInt(0x80)));
    v >>= BigInt(7);
  }
  out.push(Number(v));
}

function writeTag(out: number[], field: number, wireType: number): void {
  writeVarint(out, (field << 3) | wireType);
}

function writeFixed64(out: number[], value: bigint): void {
  let v = BigInt.asUintN(64, value);
  for (let i = 0; i < 8; i++) {
    out.push(Number(v & BigInt(0xff)));
    v >>= BigInt(8);
  }
}

function writeBytesField(out: number[], field: number, data: Uint8Array): void {
  writeTag(out, field, 2);
  writeVarint(out, data.length);
  for (let i = 0; i < data.length; i++) out.push(data[i]);
}

function writeStringField(out: number[], field: number, str: string): void {
  writeBytesField(out, field, new TextEncoder().encode(str));
}

function readU64LE(buf: Uint8Array, offset: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lo = BigInt(view.getUint32(offset, true));
  const hi = BigInt(view.getUint32(offset + 4, true));
  return lo | (hi << BigInt(32));
}

function readProtobufFields(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0;

  const readVarint = (): bigint => {
    let result = BigInt(0);
    let shift = BigInt(0);
    while (pos < buf.length) {
      const b = buf[pos++];
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += BigInt(7);
    }
    return result;
  };

  while (pos < buf.length) {
    const tag = Number(readVarint());
    const field = tag >>> 3;
    const wireType = tag & 7;

    if (wireType === 0) {
      fields.push({ field, wireType, varint: readVarint() });
    } else if (wireType === 1) {
      if (pos + 8 > buf.length) break;
      fields.push({ field, wireType, fixed64: readU64LE(buf, pos) });
      pos += 8;
    } else if (wireType === 2) {
      const len = Number(readVarint());
      if (len < 0 || pos + len > buf.length) break;
      fields.push({ field, wireType, bytes: buf.subarray(pos, pos + len) });
      pos += len;
    } else if (wireType === 5) {
      if (pos + 4 > buf.length) break;
      fields.push({ field, wireType, fixed32: view.getUint32(pos, true) });
      pos += 4;
    } else {
      break;
    }
  }
  return fields;
}

function encodeProtoHeader(steamId: bigint, sessionId: number, jobIdSource?: bigint): Uint8Array {
  const out: number[] = [];
  writeTag(out, 1, 1);
  writeFixed64(out, steamId);
  writeTag(out, 2, 0);
  writeVarint(out, sessionId);
  if (jobIdSource !== undefined) {
    writeTag(out, 10, 1);
    writeFixed64(out, jobIdSource);
  }
  return new Uint8Array(out);
}

function buildSteamPacket(emsg: number, header: Uint8Array, body: Uint8Array): Uint8Array {
  const packet = new Uint8Array(8 + header.length + body.length);
  const view = new DataView(packet.buffer);
  view.setUint32(0, (emsg | PROTO_MASK) >>> 0, true);
  view.setUint32(4, header.length, true);
  packet.set(header, 8);
  packet.set(body, 8 + header.length);
  return packet;
}

async function gunzipBytes(compressed: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream;
  if (!DS) {
    throw new Error('DecompressionStream unavailable');
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DS('gzip'));
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

function parseBinaryVdf(buf: Uint8Array): Record<string, any> {
  let offset = 0;
  // Steam PICS packageinfo buffer обычно начинается с 4-байтного uint32 заголовка перед корнем 0x00
  if (buf.length >= 5 && buf[4] === 0x00) {
    offset = 4;
  }

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const utf8 = new TextDecoder('utf-8');
  const utf16 = new TextDecoder('utf-16le');

  const readCString = (): string => {
    const start = offset;
    while (offset < buf.length && buf[offset] !== 0) offset++;
    const str = utf8.decode(buf.subarray(start, offset));
    if (offset < buf.length) offset++;
    return str;
  };

  const readWideString = (): string => {
    const start = offset;
    while (offset + 1 < buf.length && (buf[offset] !== 0 || buf[offset + 1] !== 0)) {
      offset += 2;
    }
    const str = utf16.decode(buf.subarray(start, offset));
    if (offset + 1 < buf.length) offset += 2;
    return str;
  };

  const readMap = (): Record<string, any> => {
    const obj: Record<string, any> = {};
    while (offset < buf.length) {
      const type = buf[offset++];
      if (type === 0x08 || type === 0x0b) break;
      const key = readCString();
      if (type === 0x00) {
        obj[key] = readMap();
      } else if (type === 0x01) {
        obj[key] = readCString();
      } else if (type === 0x02) {
        obj[key] = view.getInt32(offset, true);
        offset += 4;
      } else if (type === 0x03) {
        obj[key] = view.getFloat32(offset, true);
        offset += 4;
      } else if (type === 0x04 || type === 0x06) {
        obj[key] = view.getUint32(offset, true);
        offset += 4;
      } else if (type === 0x05) {
        obj[key] = readWideString();
      } else if (type === 0x07) {
        obj[key] = readU64LE(buf, offset).toString();
        offset += 8;
      } else if (type === 0x0a) {
        obj[key] = BigInt.asIntN(64, readU64LE(buf, offset)).toString();
        offset += 8;
      } else {
        break;
      }
    }
    return obj;
  };

  return readMap();
}

async function getCmWebSocketEndpoints(): Promise<string[]> {
  const url =
    'https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cmtype=websockets&maxcount=5';
  const res = await fetchViaBackend(url);
  if (res.ok && res.body) {
    try {
      const data = JSON.parse(res.body);
      const list = data?.response?.serverlist;
      if (Array.isArray(list)) {
        return list.map((s: any) => String(s.endpoint)).filter(Boolean);
      }
    } catch {}
  }
  return [];
}

function querySingleCmEndpoint(
  endpoint: string,
  subIds: number[],
  timeoutMs = 12000
): Promise<Record<number, any>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://${endpoint}/cmsocket/`);
    ws.binaryType = 'arraybuffer';

    let settled = false;
    let steamId = ANON_STEAM_ID;
    let sessionId = 0;
    const accessTokens = new Map<number, bigint>();
    const results: Record<number, any> = {};

    const cleanup = () => {
      clearTimeout(timer);
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {}
    };

    const finishOk = (data: Record<number, any>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    const finishErr = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const timer = setTimeout(() => finishErr(new Error(`CM timeout (${endpoint})`)), timeoutMs);

    const sendTokensRequest = () => {
      const body: number[] = [];
      for (const id of subIds) {
        writeTag(body, 1, 0);
        writeVarint(body, id);
      }
      const hdr = encodeProtoHeader(steamId, sessionId, BigInt(1));
      ws.send(buildSteamPacket(EMSG_PICS_ACCESS_TOKEN_REQUEST, hdr, new Uint8Array(body)));
    };

    const sendProductInfoRequest = () => {
      const body: number[] = [];
      for (const id of subIds) {
        const pkgBuf: number[] = [];
        writeTag(pkgBuf, 1, 0);
        writeVarint(pkgBuf, id);
        const tok = accessTokens.get(id);
        if (tok && tok > BigInt(0)) {
          writeTag(pkgBuf, 2, 0);
          writeVarint(pkgBuf, tok);
        }
        writeBytesField(body, 1, new Uint8Array(pkgBuf));
      }
      // meta_data_only = false (field 3), single_response = true (field 7)
      writeTag(body, 3, 0);
      writeVarint(body, 0);
      writeTag(body, 7, 0);
      writeVarint(body, 1);

      const hdr = encodeProtoHeader(steamId, sessionId, BigInt(2));
      ws.send(buildSteamPacket(EMSG_PICS_PRODUCT_INFO_REQUEST, hdr, new Uint8Array(body)));
    };

    const handlePacket = async (raw: Uint8Array): Promise<void> => {
      if (raw.length < 8) return;
      const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const rawEmsg = view.getUint32(0, true);
      if ((rawEmsg & PROTO_MASK) === 0) return;

      const emsg = (rawEmsg & ~PROTO_MASK) >>> 0;
      const hdrLen = view.getUint32(4, true);
      if (8 + hdrLen > raw.length) return;

      const hdrBytes = raw.subarray(8, 8 + hdrLen);
      const bodyBytes = raw.subarray(8 + hdrLen);

      if (emsg === EMSG_MULTI) {
        const multiFields = readProtobufFields(bodyBytes);
        let sizeUnzipped = 0;
        let payload: Uint8Array | null = null;
        for (const f of multiFields) {
          if (f.field === 1 && f.varint !== undefined) sizeUnzipped = Number(f.varint);
          if (f.field === 2 && f.bytes) payload = f.bytes;
        }
        if (!payload) return;

        let inner = payload;
        if (sizeUnzipped > 0 || (payload.length >= 2 && payload[0] === 0x1f && payload[1] === 0x8b)) {
          inner = await gunzipBytes(payload);
        }

        const innerView = new DataView(inner.buffer, inner.byteOffset, inner.byteLength);
        let offset = 0;
        while (offset + 4 <= inner.length) {
          const chunkLen = innerView.getUint32(offset, true);
          offset += 4;
          if (chunkLen === 0 || offset + chunkLen > inner.length) break;
          await handlePacket(inner.subarray(offset, offset + chunkLen));
          offset += chunkLen;
        }
        return;
      }

      if (emsg === EMSG_CLIENT_LOGON_RESPONSE) {
        const hdrFields = readProtobufFields(hdrBytes);
        for (const f of hdrFields) {
          if (f.field === 1 && f.fixed64 !== undefined) steamId = f.fixed64;
          if (f.field === 2 && f.varint !== undefined) sessionId = Number(BigInt.asIntN(32, f.varint));
        }

        const bodyFields = readProtobufFields(bodyBytes);
        const eresultField = bodyFields.find((f) => f.field === 1 && f.varint !== undefined);
        const eresult = eresultField ? Number(eresultField.varint) : 0;
        if (eresult !== 1) {
          finishErr(new Error(`Anon logon failed: EResult ${eresult}`));
          return;
        }
        sendTokensRequest();
        return;
      }

      if (emsg === EMSG_PICS_ACCESS_TOKEN_RESPONSE) {
        const bodyFields = readProtobufFields(bodyBytes);
        for (const f of bodyFields) {
          if (f.field === 1 && f.bytes) {
            const subFields = readProtobufFields(f.bytes);
            let pkgId = 0;
            let token = BigInt(0);
            for (const sf of subFields) {
              if (sf.field === 1 && sf.varint !== undefined) pkgId = Number(sf.varint);
              if (sf.field === 2 && sf.varint !== undefined) token = sf.varint;
            }
            if (pkgId > 0) accessTokens.set(pkgId, token);
          }
        }
        sendProductInfoRequest();
        return;
      }

      if (emsg === EMSG_PICS_PRODUCT_INFO_RESPONSE) {
        const bodyFields = readProtobufFields(bodyBytes);
        let responsePending = false;

        for (const f of bodyFields) {
          if (f.field === 6 && f.varint !== undefined) {
            responsePending = f.varint !== BigInt(0);
          }
          if (f.field === 4 && f.varint !== undefined) {
            const unkId = Number(f.varint);
            results[unkId] = { error: 'unknown_package' };
          }
          if (f.field === 3 && f.bytes) {
            const pkgFields = readProtobufFields(f.bytes);
            let pkgId = 0;
            let vdfBuf: Uint8Array | null = null;
            let missingToken = false;

            for (const pf of pkgFields) {
              if (pf.field === 1 && pf.varint !== undefined) pkgId = Number(pf.varint);
              if (pf.field === 3 && pf.varint !== undefined) missingToken = pf.varint !== BigInt(0);
              if (pf.field === 5 && pf.bytes) vdfBuf = pf.bytes;
            }

            if (pkgId > 0) {
              if (vdfBuf && vdfBuf.length > 0) {
                try {
                  const parsed = parseBinaryVdf(vdfBuf);
                  const pkgObj =
                    parsed[String(pkgId)] ||
                    parsed[Object.keys(parsed)[0]] ||
                    parsed;
                  results[pkgId] = pkgObj;
                } catch {
                  results[pkgId] = { error: 'vdf_parse_failed' };
                }
              } else {
                results[pkgId] = { error: missingToken ? 'missing_token' : 'empty_buffer' };
              }
            }
          }
        }

        if (!responsePending) {
          finishOk(results);
        }
      }
    };

    ws.onopen = () => {
      const body: number[] = [];
      writeTag(body, 1, 0);
      writeVarint(body, 65580); // protocol_version
      writeStringField(body, 6, 'english'); // client_language
      writeTag(body, 7, 0);
      writeVarint(body, 16); // client_os_type (Windows 10)

      const hdr = encodeProtoHeader(ANON_STEAM_ID, 0);
      ws.send(buildSteamPacket(EMSG_CLIENT_LOGON, hdr, new Uint8Array(body)));
    };

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        handlePacket(new Uint8Array(ev.data)).catch((e) => finishErr(e));
      }
    };

    ws.onerror = () => finishErr(new Error(`WebSocket error (${endpoint})`));
    ws.onclose = () => {
      if (!settled) finishErr(new Error(`WebSocket closed before response (${endpoint})`));
    };
  });
}

export async function fetchPicsPackagesDirect(subIds: number[]): Promise<Record<number, any>> {
  const uniqueIds = Array.from(new Set(subIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (uniqueIds.length === 0) return {};

  const endpoints = await getCmWebSocketEndpoints();
  const candidates = endpoints.slice(0, 3);

  for (const ep of candidates) {
    try {
      return await querySingleCmEndpoint(ep, uniqueIds);
    } catch (err) {
      console.warn('[Bibliotekarsha PICS] CM retry after error:', ep, err);
    }
  }
  return {};
}
