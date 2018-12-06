/* EscapeEmoticons ([[w:c:dev:EscapeEmoticons]])
 * 
 * Provides a checkbox for Special:Chat to automatically escape all emoticons on your messages, so they don't display as images when sent on chat.
 * Note: This script adds 4 characters to your message per emoticon, so if you're writing a message that's ~1000 characters and you're using a lot of emotes, this probably won't work.
 * Bonus: raw JS only.
 * For personal use only
 * @author: Dorumin
 */
(function() {
    if (wgCanonicalSpecialPageName != 'Chat') return;
    // Function for escaping regular expressions
    var escapeRegExp = function(s) {
            return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        },
        init = function() {
            function init(i18n) {
                // Adds the checkbox to toggle escaping
                var divbox = document.createElement('div');
                divbox.id = 'escapeEmoticons';
                divbox.style = 'text-align: center;';
                divbox.innerHTML = '<input id="escapeEmoticonsCheckbox" type="checkbox"></input><label for="escapeEmoticonsCheckbox">' + i18n.msg('escapeEmotes').plain() + '</label>';
                var cRail = document.getElementById('Rail'),
                    railWordmark = document.querySelector('#Rail h1.wordmark');
                cRail.insertBefore(divbox, railWordmark);
                // Get the list of escaped emoticons
                var emoteList = [];
                $.each(ChatView.prototype.emoticonMapping._settings, function(key, value) {
                    emoteList = emoteList.concat(value);
                });
                emoteList = emoteList.map(function(e) {
                    return escapeRegExp(e);
                });
                var regex = new RegExp(emoteList.join('|'), 'gi'),
                    // Escape the emotes before they're sent (if enabled)
                    msgTextarea = document.querySelector('#Write .message textarea');
                msgTextarea.addEventListener('keypress', function(e) {
                    if (document.getElementById('escapeEmoticonsCheckbox') === null) return; // Raw JavaScript hates exceptions.
                    var isChecked = document.getElementById('escapeEmoticonsCheckbox').checked;
                    var key = e.which || e.keyCode || 0;
                    if (key != 13 || !isChecked || e.shiftKey) return;
                    var msgVal = this.value,
                        newValue = msgVal.replace(regex, '[[]]$&');
                    this.value = newValue;
                });
            }
            mw.hook('dev.i18n').add(function(i18n) {
                i18n.loadMessages('EscapeEmoticons').then(init);
            });
            importArticle({
                type: 'script',
                article: 'u:dev:MediaWiki:I18n-js/code.js'
            });
        };
    var interval = setInterval(function() {
        if (!window.mainRoom) return; 
        clearInterval(interval);
        init();
    }, 250);
})();