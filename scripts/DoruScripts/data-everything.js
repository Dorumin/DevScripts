mw.hook('dev.chat.render').add(function() {
    function on_user_event(event, data) {
        var last = mainRoom.model.chats.last(),
        $entry = $('#entry-' + last.cid),
        attrs = data.attributes || JSON.parse(data.data).attrs;

        if (!last.attributes.isInlineAlert) return;
        switch (event) {
            case 'join':
                if (last.attributes.text == mw.message('chat-user-joined', attrs.name).escaped()) {
                    $entry
                        .attr('data-type', 'join')
                        .attr('data-user', attrs.name);
                }
                break;
            case 'part':
                if (last.attributes.text == mw.message('chat-user-parted', attrs.name).escaped()) {
                    $entry
                        .attr('data-type', 'part')
                        .attr('data-user', attrs.name);
                }
                break;
            case 'kick':
                $entry
                    .attr('data-type', 'kick')
                    .attr('data-user', attrs.kickedUserName)
                    .attr('data-mod', attrs.moderatorName);
                break;
            case 'ban':
                $entry
                    .attr('data-type', attrs.time ? 'ban' : 'unban')
                    .attr('data-user', attrs.kickedUserName)
                    .attr('data-mod', attrs.moderatorName)
                    .attr('data-time', attrs.time)
                    .attr('data-reason', attrs.reason);
                break;
        }
    }
    
    mainRoom.model.users.bind('remove', on_user_event.bind(this, 'part'));
    mainRoom.socket.bind('join', on_user_event.bind(this, 'join'));
    mainRoom.socket.bind('kick', on_user_event.bind(this, 'kick'));
    mainRoom.socket.bind('ban', on_user_event.bind(this, 'ban'));
});

importArticle({
    type: 'script',
    article: 'u:dev:MediaWiki:Chat-js.js'
});
