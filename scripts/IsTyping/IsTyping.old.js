/* IsTyping
 *
 * Displays which users are typing on chat.
 * Affects private messages by default.
 *
 * @scope site-wide
 * @author Dorumin
 */

(function() {
    if (mw.config.get('wgCanonicalSpecialPageName') !== 'Chat' || window.IsTyping_init) {
        return;
    }
    window.IsTyping_init = true;
    var lastRequestTimestamp = 0,
        currentState = false,
        i18n, loaded = 0;
        
    // Get the room object for the active room
    function getCurrentRoom() {
        if (mainRoom.activeRoom == 'main' || mainRoom.activeRoom === null) {
            return mainRoom;
        }
        return mainRoom.chats.privates[mainRoom.activeRoom];
    }
    
    // Announce to your current room that you're typing
    function sendTypingState(state) {
        currentState = state;
        var currentRoom = getCurrentRoom(),
        isMain = currentRoom.isMain();
        if (
             isMain && IsTyping.mainRoomDisabled ||
            !isMain && IsTyping.privateRoomDisabled
        ) {
            return;
        }
        currentRoom.socket.send(new models.SetStatusCommand({
            statusMessage: 'typingState',
            statusState: state
        }).xport());
    }
    
    // Update the typing indicator
    function showUsersTyping(id, user, status) {
        if (!IsTyping.data[id]) {
            IsTyping.data[id] = [];
            IsTyping.data[id].timeouts = {};
        }
        var pointer = IsTyping.data[id],
        curRoom = getCurrentRoom(),
        $body = $(document.body);
        if (user) {
            if (status === true) {
                if (pointer.timeouts[user]) {
                    clearTimeout(pointer.timeouts[user]);
                }
                pointer.timeouts[user] = setTimeout(function() {
                    var i = pointer.indexOf(user);
                    pointer.splice(i, 1);
                    showUsersTyping(id);
                    delete pointer.timeouts[user];
                }, 10000);
                if (pointer.indexOf(user) == -1) {
                    pointer.push(user);
                }
            } else {
                var i = pointer.indexOf(user);
                pointer.splice(i, 1);
                clearTimeout(pointer.timeouts[user]);
                delete pointer.timeouts[user];
            }
        }
        if (curRoom.roomId != id) return; // No need to update; the change was for another room
        var hasIndicator = $body.hasClass('is-typing'),
        div = curRoom.viewDiscussion.chatDiv.get(0);
        if (!pointer.length) {
            $body.removeClass('is-typing');
            IsTyping.$indicator.html('');
            if (
                IsTyping.doScroll &&
                hasIndicator &&
                div.scrollHeight - div.clientHeight != div.scrollTop
            ) {
                div.scrollTop -= 20;
            }
        } else {
            $body.addClass('is-typing');
            var args = pointer.map(function(user) {
                // .parse() should do the escaping for us
                return '<span class="username">' + user + '</span>';
            });
            args.unshift('typing-' + (pointer.length > 3 ? 'more' : pointer.length));
            IsTyping.$indicator.html(i18n.msg.apply(window, args).parse());
            if (IsTyping.doScroll && !hasIndicator) {
                div.scrollTop += 20;
            }
        }
    }
    
    // Bind your typing to the socket requests
    $(document.getElementsByName('message')).keydown(function(e) {
        var that = this,
        oldVal = this.value,
        data = IsTyping.data[getCurrentRoom().roomId] || {},
        lastTime = data.timestamp || 0;
        setTimeout(function() {
            if (oldVal != that.value && !that.value) {
                data.timestamp = 0;
                sendTypingState(false);
                return;
            }
            if (oldVal != that.value && Date.now() - lastTime > 8000) { // if more than 8 seconds have passed
                data.timestamp = Date.now();
                sendTypingState(true);
            }
        }, 0);
    }).blur(function() { // when the user clicks away of the textarea, or the window
        var data = IsTyping.data[getCurrentRoom().roomId];
        if (data) {
            data.timestamp = 0;
        }
        sendTypingState(false);
    });
    
    // Update the typing list when you switch rooms accordingly
    function click() {
        showUsersTyping(mainRoom.activeRoom == 'main' || mainRoom.activeRoom === null ? mainRoom.roomId : mainRoom.activeRoom);
    }
    
    // Generate binding for socket updates to showUsersTyping
    function generateBinding(type) {
        return function(msg) {
            var data = JSON.parse(msg.data).attrs,
                status = data.statusState,
                user = data.name,
                roomId = this.roomId;
            if (
                (user != wgUserName || !IsTyping.filterSelf) &&
                data.statusMessage == 'typingState' &&
                !IsTyping[type + 'RoomDisabled']
            ) {
                showUsersTyping(roomId, user, status);
            }
        };
    }
    
    // Now for private messages!
    function bindPrivateRooms(u) {
        var privateRoomId = u.attributes.roomId,
        privateRoom = mainRoom.chats.privates[privateRoomId];
        privateRoom.socket.on('updateUser', generateBinding('private'));
    }
    
    // Initialize bindings
    function init(i18nd) {
        i18n = i18nd;
        mainRoom.socket.on('updateUser', generateBinding('main'));
        mainRoom.model.privateUsers.bind('add', bindPrivateRooms);
        $(document).click('#PrivateChatList .User, #Rail .wordmark', click);
    }
    
    // Preload required resources
    function preload() {
        if (++loaded === 2) {
            window.dev.i18n.loadMessages('IsTyping')
                .then(init);
        }
    }
    mw.hook('dev.i18n').add(preload);
    mw.hook('dev.chat.render').add(preload);
    // Declare a global variable for debugging
    window.IsTyping = $.extend({
        sendTypingState: sendTypingState,
        showUsersTyping: showUsersTyping,
        getCurrentRoom: getCurrentRoom,
        $indicator: (window.IsTyping && IsTyping.$indicator) || $('<div>', {
            class: 'typing-indicator'
        }).prependTo('#Write'),
        data: {},
        doScroll: true,
        filterSelf: true
    }, window.IsTyping);
    if (!IsTyping.noStyle) {
        importArticle({
            type: 'style',
            articles: [
                'u:dev:MediaWiki:IsTyping.css'
            ]
        });
    }
    importArticles({
        type: 'script',
        articles: [
            'u:dev:MediaWiki:I18n-js/code.js',
            'u:dev:MediaWiki:Chat-js.js'
        ]
    });
})();
