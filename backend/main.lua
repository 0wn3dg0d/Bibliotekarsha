local millennium = require("millennium")
local logger = require("logger")

local function on_load()
    logger:info("Bibliotekarsha v0.5.0 Beta loaded")
    millennium.ready()
end

local function on_unload()
    logger:info("Bibliotekarsha v0.5.0 Beta unloaded")
end

return {
    on_load = on_load,
    on_unload = on_unload
}
