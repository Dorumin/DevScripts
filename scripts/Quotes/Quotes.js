/* Quotes
 *
 *
 *
 * 
 * @author Dorumin
 */

(function() {
    if (
        mw.config.get('wgCanonicalSpecialPageName') != 'Chat'
    ) return;

    function closest(test, node) {
        while (node = node.parentElement) {
            if (node.matches(test)) return node;
        }
        return null;
    }

    function inside(node, parent) {
        while (node) {
            if (node == parent) return true;
            node = node.parentElement;
        }
        return false;
    }

    function nodesBetween(n1, n2) {
        var pos = n1.compareDocumentPosition(n2),
        start = pos & Node.DOCUMENT_POSITION_FOLLOWING ? n1 : n2,
        end   = pos & Node.DOCUMENT_POSITION_PRECEDING ? n1 : n2,
        nodes = [start];
        while (start != end) {
            nodes.push(start = start.nextElementSibling);
        }
        return nodes;
    }

    function isBetween(node, n1, n2) {
        var pos = n1.compareDocumentPosition(n2),
        start = pos & Node.DOCUMENT_POSITION_FOLLOWING ? n1 : n2,
        end   = pos & Node.DOCUMENT_POSITION_PRECEDING ? n1 : n2;

        return node.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_PRECEDING &&
            node.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING;
    }

    window.addEventListener('copy', function() {
        var sel = getSelection(),
        string = sel.toString(),
        start = closest('.Chat li', sel.anchorNode),
        end = closest('.Chat li', sel.extentNode);

        if (!start || !end) return;

        var between = nodesBetween(start, end),
        lines = [];
    
        between.forEach(function(entry) {
            var message = entry.querySelector('.message') || entry,
            text = '',
            temp;

            if (sel.anchorNode == sel.extentNode) {
                text = sel.anchorNode.textContent.slice(sel.anchorOffset, sel.extentOffset);
            } else if (inside(sel.extentNode, message) && inside(sel.anchorNode, message)) {
                text = string;
            } else if (inside(sel.extentNode, message)) {
                var temp = message.textContent.slice(0, sel.extentOffset).trim();
                if (string.slice(-temp.length) == temp) {
                    text = temp;
                } else {
                    text = message.textContent.slice(sel.extentOffset);
                }
            } else if (inside(sel.anchorNode, message)) {
                var temp = message.textContent.slice(0, sel.anchorOffset).trim();
                if (string.slice(-temp.length) == temp) {
                    text = temp;
                } else {
                    text = message.textContent.slice(sel.anchorOffset);
                }
            } else if (isBetween(message, sel.anchorNode, sel.extentNode)) {
                text = message.textContent;
            } else {
                console.log('what', message, sel.anchorNode, sel.extentNode);
            }

            console.log(message, text);
        });


        console.log(sel);
    });
})();