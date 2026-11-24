local millennium = require("millennium")
local logger = require("logger")
local json = require("json")
local http = require("http")

local CP1251 = {
    [0x80]="\208\130",[0x81]="\208\131",[0x82]="\226\128\154",[0x83]="\209\147",
    [0x84]="\226\128\158",[0x85]="\226\128\166",[0x86]="\226\128\160",[0x87]="\226\128\161",
    [0x88]="\226\130\172",[0x89]="\226\128\176",[0x8A]="\208\137",[0x8B]="\226\128\185",
    [0x8C]="\208\138",[0x8D]="\208\140",[0x8E]="\208\139",[0x8F]="\208\143",
    [0x90]="\209\146",[0x91]="\226\128\152",[0x92]="\226\128\153",[0x93]="\226\128\156",
    [0x94]="\226\128\157",[0x95]="\226\128\162",[0x96]="\226\128\147",[0x97]="\226\128\148",
    [0x98]=" ",[0x99]="\226\132\162",[0x9A]="\209\153",[0x9B]="\226\128\186",
    [0x9C]="\209\154",[0x9D]="\209\156",[0x9E]="\209\155",[0x9F]="\209\159",
    [0xA0]="\194\160",[0xA1]="\208\142",[0xA2]="\209\158",[0xA3]="\208\136",
    [0xA4]="\194\164",[0xA5]="\210\144",[0xA6]="\194\166",[0xA7]="\194\167",
    [0xA8]="\208\129",[0xA9]="\194\169",[0xAA]="\208\132",[0xAB]="\194\171",
    [0xAC]="\194\172",[0xAD]="\194\173",[0xAE]="\194\174",[0xAF]="\208\135",
    [0xB0]="\194\176",[0xB1]="\194\177",[0xB2]="\208\134",[0xB3]="\209\150",
    [0xB4]="\210\145",[0xB5]="\194\181",[0xB6]="\194\182",[0xB7]="\194\183",
    [0xB8]="\209\145",[0xB9]="\226\132\150",[0xBA]="\209\148",[0xBB]="\194\187",
    [0xBC]="\209\152",[0xBD]="\208\133",[0xBE]="\209\149",[0xBF]="\209\151"
}
for b = 0xC0, 0xEF do CP1251[b] = string.char(0xD0, b - 0x30) end
for b = 0xF0, 0xFF do CP1251[b] = string.char(0xD1, b - 0x70) end

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
            local c2, c3 = s:byte(i + 1, i + 2)
            if not c2 or not c3 or c2 < 0x80 or c2 > 0xBF or c3 < 0x80 or c3 > 0xBF then return false end
            i = i + 3
        elseif c >= 0xF0 and c <= 0xF4 then
            local c2, c3, c4 = s:byte(i + 1, i + 3)
            if not c2 or not c3 or not c4 or c2 < 0x80 or c2 > 0xBF or c3 < 0x80 or c3 > 0xBF or c4 < 0x80 or c4 > 0xBF then return false end
            i = i + 4
        else
            return false
        end
    end
    return true
end

local function to_safe_utf8(s)
    if not s or #s == 0 then return "" end
    if is_valid_utf8(s) then return s end
    local out = {}
    local idx = 1
    for i = 1, #s do
        local b = s:byte(i)
        if b < 0x80 then
            out[idx] = string.char(b)
        else
            out[idx] = CP1251[b] or "?"
        end
        idx = idx + 1
    end
    return table.concat(out)
end

---@ffi
---@param options_json string
---@return string
function fetch_url(options_json)
    local ok_parse, opts = pcall(json.decode, options_json)
    if not ok_parse or type(opts) ~= "table" or not opts.url then
        return json.encode({ ok = false, status = 0, error = "bad_args" })
    end

    local method = (opts.method or "GET"):upper()
    local req_headers = opts.headers or {}
    local ua = req_headers["User-Agent"] or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    local res, err
    if method == "POST" then
        res, err = http.post(opts.url, opts.body or "", {
            headers = req_headers,
            user_agent = ua,
            timeout = 15,
            follow_redirects = true
        })
    else
        res, err = http.get(opts.url, {
            headers = req_headers,
            user_agent = ua,
            timeout = 15,
            follow_redirects = true
        })
    end

    if not res then
        logger:warn("fetch_url failed [" .. tostring(opts.url) .. "]: " .. tostring(err))
        return json.encode({ ok = false, status = 0, error = tostring(err) })
    end

    local status = tonumber(res.status) or 200
    local body = to_safe_utf8(res.body or "")

    return json.encode({
        ok = status >= 200 and status < 300,
        status = status,
        body = body
    })
end

local function on_load()
    logger:info("Bibliotekarsha v0.6.0 Beta loaded")
    millennium.ready()
end

local function on_unload()
    logger:info("Bibliotekarsha v0.6.0 Beta unloaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
    fetch_url = fetch_url
}
