local millennium = require("millennium")
local http = require("http")
local json = require("json")

local DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

local STEAM_AUTH_COOKIE = ""
local STEAM_AUTH_ID64 = ""

local CP1251_EXTRA = {
    [0x80] = "\208\130", [0x81] = "\208\131", [0x82] = "\226\128\154", [0x83] = "\209\147",
    [0x84] = "\226\128\158", [0x85] = "\226\128\166", [0x86] = "\226\128\160", [0x87] = "\226\128\161",
    [0x88] = "\226\130\172", [0x89] = "\226\128\176", [0x8A] = "\208\137", [0x8B] = "\226\128\185",
    [0x8C] = "\208\138", [0x8D] = "\208\140", [0x8E] = "\208\139", [0x8F] = "\208\143",
    [0x90] = "\209\146", [0x91] = "\226\128\152", [0x92] = "\226\128\153", [0x93] = "\226\128\156",
    [0x94] = "\226\128\157", [0x95] = "\226\128\162", [0x96] = "\226\128\147", [0x97] = "\226\128\148",
    [0x98] = " ",        [0x99] = "\226\132\162", [0x9A] = "\209\153", [0x9B] = "\226\128\186",
    [0x9C] = "\209\154", [0x9D] = "\209\156", [0x9E] = "\209\155", [0x9F] = "\209\159",
    [0xA0] = "\194\160", [0xA1] = "\208\142", [0xA2] = "\209\158", [0xA3] = "\208\136",
    [0xA4] = "\194\164", [0xA5] = "\210\144", [0xA6] = "\194\166", [0xA7] = "\194\167",
    [0xA8] = "\208\129", [0xA9] = "\194\169", [0xAA] = "\208\132", [0xAB] = "\194\171",
    [0xAC] = "\194\172", [0xAD] = "\194\173", [0xAE] = "\194\174", [0xAF] = "\208\135",
    [0xB0] = "\194\176", [0xB1] = "\194\177", [0xB2] = "\208\134", [0xB3] = "\209\150",
    [0xB4] = "\210\145", [0xB5] = "\194\181", [0xB6] = "\194\182", [0xB7] = "\194\183",
    [0xB8] = "\209\145", [0xB9] = "\226\132\150", [0xBA] = "\209\148", [0xBB] = "\194\187",
    [0xBC] = "\209\152", [0xBD] = "\208\133", [0xBE] = "\209\149", [0xBF] = "\209\151"
}

local function is_valid_utf8(s)
    local i, len = 1, #s
    while i <= len do
        local c = s:byte(i)
        if c < 0x80 then
            i = i + 1
        elseif c >= 0xC2 and c <= 0xDF then
            local c2 = s:byte(i + 1)
            if not c2 or c2 < 0x80 or c2 > 0xBF then return false end
            i = i + 2
        elseif c >= 0xE0 and c <= 0xEF then
            local c2, c3 = s:byte(i + 1), s:byte(i + 2)
            if not c2 or not c3 or c2 < 0x80 or c2 > 0xBF or c3 < 0x80 or c3 > 0xBF then return false end
            i = i + 3
        elseif c >= 0xF0 and c <= 0xF4 then
            local c2, c3, c4 = s:byte(i + 1), s:byte(i + 2), s:byte(i + 3)
            if not c2 or not c3 or not c4 or c2 < 0x80 or c2 > 0xBF or c3 < 0x80 or c3 > 0xBF or c4 < 0x80 or c4 > 0xBF then return false end
            i = i + 4
        else
            return false
        end
    end
    return true
end

local function cp1251_to_utf8(s)
    local out = {}
    for i = 1, #s do
        local b = s:byte(i)
        if b < 0x80 then
            out[i] = string.char(b)
        elseif b >= 0xC0 and b <= 0xEF then
            out[i] = string.char(0xD0, b - 0x30)
        elseif b >= 0xF0 and b <= 0xFF then
            out[i] = string.char(0xD1, b - 0x70)
        else
            out[i] = CP1251_EXTRA[b] or "?"
        end
    end
    return table.concat(out)
end

local function ensure_utf8(s)
    if not s or #s == 0 then return "" end
    if is_valid_utf8(s) then return s end
    return cp1251_to_utf8(s)
end

---@ffi
---@return string
function get_active_steam_id()
    return json.encode({ steamId64 = STEAM_AUTH_ID64 or '' })
end

---@ffi
---@param auth_json string
---@return string
function set_steam_auth(auth_json)
    local ok, data = pcall(json.decode, auth_json)
    if ok and type(data) == "table" then
        if data.reset == true then
            STEAM_AUTH_COOKIE = ""
            STEAM_AUTH_ID64 = ""
        end
        if type(data.steamId64) == "string" and #data.steamId64 > 0 then
            if STEAM_AUTH_ID64 ~= "" and STEAM_AUTH_ID64 ~= data.steamId64 then
                STEAM_AUTH_COOKIE = ""
            end
            STEAM_AUTH_ID64 = data.steamId64
        end
        if type(data.cookie) == "string" and #data.cookie > 0 then
            STEAM_AUTH_COOKIE = data.cookie
        end
        return json.encode({ ok = true, has_cookie = (#STEAM_AUTH_COOKIE > 0), has_id = (#STEAM_AUTH_ID64 > 0) })
    end
    return json.encode({ ok = false })
end

---@ffi
---@param options_json string
---@return string
function fetch_url(options_json)
    local ok_parse, opts = pcall(json.decode, options_json)
    if not ok_parse or type(opts) ~= "table" or not opts.url then
        return json.encode({ ok = false, status = 0, error = "Invalid request options" })
    end

    local url = tostring(opts.url)
    local method = string.upper(tostring(opts.method or "GET"))
    local raw_headers = type(opts.headers) == "table" and opts.headers or {}
    local use_steam_auth = (opts.use_steam_auth == true)
    local auth_injected = false

    if use_steam_auth then
        if url:find("{{STEAM_ID64}}", 1, true) then
            if #STEAM_AUTH_ID64 > 0 then
                url = url:gsub("{{STEAM_ID64}}", STEAM_AUTH_ID64)
            else
                url = url:gsub("/profiles/{{STEAM_ID64}}/", "/my/")
            end
        end
    end

    local clean_headers = {}
    local user_agent = DEFAULT_UA
    local has_cookie = false
    for k, v in pairs(raw_headers) do
        local lk = tostring(k):lower()
        if lk == "user-agent" then
            user_agent = tostring(v)
        elseif lk == "cookie" then
            has_cookie = true
            clean_headers["Cookie"] = tostring(v)
        else
            clean_headers[tostring(k)] = tostring(v)
        end
    end
    clean_headers["User-Agent"] = user_agent

    if use_steam_auth and not has_cookie and #STEAM_AUTH_COOKIE > 0 then
        clean_headers["Cookie"] = STEAM_AUTH_COOKIE
        auth_injected = true
    end

    local timeout_sec = tonumber(opts.timeout) or 15
    if timeout_sec > 300 then
        timeout_sec = math.max(5, math.floor(timeout_sec / 1000))
    end

    local body_str = tostring(opts.body or "")
    local req_opts = {
        method = method,
        headers = clean_headers,
        timeout = timeout_sec,
        follow_redirects = true,
        verify_ssl = true,
        user_agent = user_agent
    }
    if method == "POST" then
        req_opts.data = body_str
        req_opts.body = body_str
    end

    local ok_req, response, err = pcall(http.request, url, req_opts)
    if (not ok_req or not response) and method == "POST" then
        ok_req, response, err = pcall(http.post, url, body_str, req_opts)
    end

    if not ok_req then
        return json.encode({ ok = false, status = 0, error = tostring(response), auth_injected = auth_injected })
    end
    if not response then
        return json.encode({ ok = false, status = 0, error = tostring(err or "HTTP request failed"), auth_injected = auth_injected })
    end

    local status = tonumber(response.status) or 0
    local body_utf8 = ensure_utf8(tostring(response.body or ""))

    local resp_cookies = {}
    if type(response.headers) == "table" then
        for hk, hv in pairs(response.headers) do
            if tostring(hk):lower() == "set-cookie" then
                if type(hv) == "table" then
                    for _, item in ipairs(hv) do
                        local pair = tostring(item):match("^([^;]+)")
                        if pair then table.insert(resp_cookies, pair) end
                    end
                else
                    local s = tostring(hv):gsub("([Ee]xpires=%a%a%a),", "%1 ")
                    for part in s:gmatch("[^,]+") do
                        local pair = part:match("^%s*([^;=]+=[^;]+)")
                        if pair and not pair:lower():match("^expires=") then
                            table.insert(resp_cookies, pair)
                        end
                    end
                end
            end
        end
    end

    return json.encode({
        ok = (status >= 200 and status < 400),
        status = status,
        body = body_utf8,
        cookies = table.concat(resp_cookies, "; "),
        auth_injected = auth_injected
    })
end

local BSH_STORE_LOADED = false
local BSH_STORE_DATA = {}

local function get_bsh_storage_path()
    local appdata = os.getenv("APPDATA")
    if appdata and #appdata > 0 then
        return appdata .. "\\Bibliotekarsha_userdata.json"
    end
    local home = os.getenv("HOME")
    if home and #home > 0 then
        return home .. "/.bibliotekarsha_userdata.json"
    end
    return "bibliotekarsha_userdata.json"
end

local function ensure_bsh_store_loaded()
    if BSH_STORE_LOADED then return end
    BSH_STORE_LOADED = true
    local path = get_bsh_storage_path()
    local ok, f = pcall(io.open, path, "rb")
    if ok and f then
        local content = f:read("*a")
        f:close()
        if content and #content > 0 then
            local ok_dec, decoded = pcall(json.decode, content)
            if ok_dec and type(decoded) == "table" then
                BSH_STORE_DATA = decoded
            end
        end
    end
end

local function is_lua_array(t)
    if type(t) ~= "table" then return false end
    local count = 0
    for k, _ in pairs(t) do
        if type(k) ~= "number" or k < 1 or math.floor(k) ~= k then
            return false
        end
        count = count + 1
    end
    return count > 0 and count == #t
end

local function merge_arrays_unique(dst, src)
    local out = {}
    local seen = {}
    local function add_item(item)
        local key
        if type(item) == "table" and item.id ~= nil then
            key = "id:" .. tostring(item.id)
        elseif type(item) == "table" and item.gid ~= nil then
            key = "gid:" .. tostring(item.gid)
        else
            key = type(item) .. ":" .. tostring(item)
        end
        if not seen[key] then
            seen[key] = true
            out[#out + 1] = item
        end
    end
    for _, item in ipairs(dst) do add_item(item) end
    for _, item in ipairs(src) do add_item(item) end
    return out
end

local function save_bsh_store_to_disk()
    local path = get_bsh_storage_path()
    local encoded = "{}"
    if next(BSH_STORE_DATA) ~= nil then
        local ok_enc, enc = pcall(json.encode, BSH_STORE_DATA)
        if not ok_enc then return false end
        encoded = enc
    end

    local tmp_path = path .. ".tmp"
    local ok_tmp, f_tmp = pcall(io.open, tmp_path, "wb")
    if ok_tmp and f_tmp then
        local ok_write = f_tmp:write(encoded)
        f_tmp:close()
        if ok_write then
            os.remove(path)
            local renamed = os.rename(tmp_path, path)
            if renamed then
                return true
            end
            os.remove(tmp_path)
        else
            os.remove(tmp_path)
        end
    end

    local ok_open, f = pcall(io.open, path, "wb")
    if ok_open and f then
        f:write(encoded)
        f:close()
        return true
    end
    return false
end

---@ffi
---@param payload_json string
---@return string
function bsh_storage_get(payload_json)
    ensure_bsh_store_loaded()
    local ok, req = pcall(json.decode, payload_json)
    if not ok or type(req) ~= "table" or type(req.key) ~= "string" then
        return json.encode({ ok = false, found = false })
    end
    local epoch = tonumber(BSH_STORE_DATA["__bsh_overwrite_epoch"]) or 0
    local val = BSH_STORE_DATA[req.key]
    if val == nil then
        return json.encode({ ok = true, found = false, overwrite_epoch = epoch })
    end
    return json.encode({ ok = true, found = true, value = val, overwrite_epoch = epoch })
end

---@ffi
---@param payload_json string
---@return string
function bsh_storage_set(payload_json)
    ensure_bsh_store_loaded()
    local ok, req = pcall(json.decode, payload_json)
    if not ok or type(req) ~= "table" or type(req.key) ~= "string" then
        return json.encode({ ok = false })
    end
    if req.remove == true then
        BSH_STORE_DATA[req.key] = nil
    else
        BSH_STORE_DATA[req.key] = req.value
    end
    local saved = save_bsh_store_to_disk()
    return json.encode({ ok = true, persisted = saved })
end

---@ffi
---@return string
function bsh_storage_export_all()
    ensure_bsh_store_loaded()
    local clean = {}
    for k, v in pairs(BSH_STORE_DATA) do
        local ks = tostring(k)
        if ks:sub(1, 6) ~= "__bsh_" then
            clean[ks] = v
        end
    end
    return json.encode({ ok = true, path = get_bsh_storage_path(), data = clean })
end

---@ffi
---@param payload_json string
---@return string
function bsh_storage_import_all(payload_json)
    ensure_bsh_store_loaded()
    local ok, req = pcall(json.decode, payload_json)
    if not ok or type(req) ~= "table" or type(req.data) ~= "table" then
        return json.encode({ ok = false, error = "Invalid backup payload" })
    end
    if req.mode == "overwrite" then
        local next_epoch = (tonumber(BSH_STORE_DATA["__bsh_overwrite_epoch"]) or 0) + 1
        BSH_STORE_DATA = { __bsh_overwrite_epoch = next_epoch }
    end
    local count = 0
    for k, v in pairs(req.data) do
        local ks = tostring(k)
        if ks:sub(1, 6) ~= "__bsh_" then
            local existing = BSH_STORE_DATA[ks]
            if req.mode == "merge" and type(v) == "table" and type(existing) == "table" then
                if ks == "use_game_notes_db_v2" or ks:match("^use_incognito_wishlist_db_v1") then
                    for nk, nv in pairs(v) do
                        existing[nk] = nv
                    end
                elseif ks:match("^use_hiddenNewsData") or ks:match("^salesMaster_v1_") then
                    if is_lua_array(existing) or is_lua_array(v) then
                        BSH_STORE_DATA[ks] = merge_arrays_unique(existing, v)
                    else
                        for nk, nv in pairs(v) do
                            if type(nv) == "table" and type(existing[nk]) == "table" and (is_lua_array(existing[nk]) or is_lua_array(nv)) then
                                existing[nk] = merge_arrays_unique(existing[nk], nv)
                            else
                                existing[nk] = nv
                            end
                        end
                    end
                else
                    BSH_STORE_DATA[ks] = v
                end
            else
                BSH_STORE_DATA[ks] = v
            end
            count = count + 1
        end
    end
    local saved = save_bsh_store_to_disk()
    return json.encode({ ok = true, imported = count, persisted = saved })
end

local function on_load()
    millennium.ready()
end

local function on_unload()
end

return {
    on_load = on_load,
    on_unload = on_unload
}
