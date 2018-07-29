/* HoverEditCount (AjaxEditCount)
 *
 * Loads the edit count by hovering over the tally in the user masthead.
 * @scope: any
 * @author: Dorumin
 */
$(function() {
    if (!$ || !mw || !$('.tally').length || window.HoverEditCountInit) return;
    window.HoverEditCountInit = true;
    var obj = {
        css:'.editCount {               \
                z-index: 100;           \
                position: absolute;     \
            }                           \
            .ecrowcenter {              \
                text-align: center;     \
            }                           \
            .ecrowright {               \
                text-align: right;      \
            }                           \
            .TablePager,                \
            .TablePager td,             \
            .TablePager th {            \
                padding: 0.20em 0.15em; \
            }',
        x: 0,
        y: 0,
        t: 0, // For the timeout, not for placing the div.
        html: false,
        wait: false,
        elem: false,
        name: $('[itemprop="name"]').text(),
        $div: $('<div class="editCount" />'),
        $tally: $('.tally'),
        preload: window.preloadEditCount || false,
        delay: window.hoverEditCountDelay || 300,
        addDiv: function() {
            $('.editCount').remove();
            this.$div.css({
                top: this.y,
                left: this.x
            })
            .html(self.html)
            .appendTo(document.body);
        },
        isHover: function(el) {
            return Boolean($(el).closest('.tally, .editCount').length);
        },
        getEdits: function() {
            var self = this;
            if (self.html) return;
            $.get('/wiki/Special:EditCount/' + self.name, function(d) {
                self.html = $(d).find('.TablePager').parent().html();
                if ( self.wait && self.isHover(self.elem) ) 
                    self.addDiv();
            });
        },
        hover: function() {
            var self = obj;
            if ($('.editCount').length) return;
            self.getEdits();
            self.t = setTimeout(function() {
                if (!self.html) self.wait = true;
                else if (self.isHover(self.elem))
                    self.addDiv();
            }, self.delay);
        },
        unhover: function() {
            var self = obj;
            setTimeout(function() {
               if (self.isHover(self.elem)) {
                   self.$div.hover($.noop, self.unhover);
               } else {
                   self.$div.remove();
                   clearTimeout(self.t);
               }
            }, 100);
        },
        init: function() {
            window.self = this;
            mw.util.addCSS(self.css);
            $(document).mousemove(function(e) {
                self.x    = e.pageX;
                self.y    = e.pageY;
                self.elem = e.target;
            });
            if (self.preload)
                self.getEdits();
            self.$tally.hover(self.hover, self.unhover);
        }
    };
    obj.init();
});