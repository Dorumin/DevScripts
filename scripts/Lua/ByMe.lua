local p = {}
local dpl = require('Dev:Sandbox/Dorumin/DPL')

local function toList(iterator)
    local list = {}
    for n in iterator do
        list[#list + 1] = n
    end
    return list
end

-- You can't use ordermethod alongside createdby
local function compareDates(a, b)
    a = toList(a:gmatch('%d+'))
    b = toList(b:gmatch('%d+'))
    for i in ipairs(a) do
        local first = tonumber(a[i])
        local second = tonumber(b[i])
        if first > second then
            return false
        elseif first < second then
            return true
        end
    end
    return false
end

local function getDate(title)
    return dpl.parse({
        title = title,
        ordermethod = 'firstedit',
        addeditdate = 1,
        format = ',,%DATE%,'
    })
end

local function getName(title)
    return title:gsub('MediaWiki:', ''):gsub('/.+', ''):gsub('%.js', '')
end

local function myStuff()
    local mwpages = dpl.list({
        namespace = 'MediaWiki',
        createdby = 'Dorumin',
        titlematch = '%.js'
    })
    local pages = {}
    local filter = {
        ['QuickLogs'] = 1,
        ['HTMLToUI-js'] = 1
    }
    for _, page in ipairs(mwpages) do
        local name = getName(page)
        if not filter[name] then
            filter[name] = 1
            table.insert(pages, page)
        end
    end
    return pages
end

local function sortByCreation(pages)
    local dates = {}
    for _, page in ipairs(pages) do
        dates[page] = getDate(page)
    end
    table.sort(pages, function(a, b)
        return compareDates(dates[a], dates[b])
    end)
    return pages
end

local function formatList(ordered, list)
    local del = '* '
    local wikitext = ''
    local goodStuff = {
        AjaxBlock = 1,
        IsTyping = 1,
        ReplyList = 1,
        RefreshThreads = 1,
        ExtendedPrivateMessaging = 1,
        Pings = 1,
        ChatLinkPreview = 1
    }
    if ordered then
        del = '# '
    end
    for _, page in ipairs(list) do
        local name = getName(page)
        if goodStuff[name] then
            name = "'''[[" .. name .. "]]'''"
        else
            name = "[[" .. name .. "]]"
        end
        wikitext = wikitext .. del ..  name .. ' <sup>([[' .. page .. '|src]])</sup>\n'
    end
    return wikitext
end

function p.creation()
    local pages = sortByCreation(myStuff())
    return formatList(true, pages)
end

function p.alphabetical()
    -- Should default to alphabetical order
    local pages = myStuff()
    return formatList(false, pages)
end
 
return p