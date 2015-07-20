$(function() {    

    var win = window, doc = document;
    var socket = io.connect('/control');

    var MESSAGE_INTRODUCTION = 'こんにちは，よろしくお願いします。';

    var isTouch = ("ontouchstart" in win) ? true : false,
        START = isTouch ? "touchstart" : "mousedown",
        MOVE = isTouch ? "touchmove" : "mousemove",
        END = isTouch ? "touchend" : "mouseup";

    var vendorPrefix = '-webkit-';
    
    var smphController = {
        elements : {
            buttons: $("#up, #right, #down, #left"),
        },
        data : {
            direction : 'n',
            speed : 0,
            raise: 0,
            swing: 0
        },

        initialize : function() {

            function touchHandler (ev) {
                var evn = ev.data.evn;
                switch (evn) {
                    case 'start':
                        var id = $(ev.originalEvent.touches[0].target).attr('id');
                        switch (id) {
                            case 'up':
                            case 'right':
                            case 'down':
                            case 'left':
                                ev.preventDefault();
                                if (data.direction != 'n') {
                                    return;
                                }
                                $('#' + id).addClass('touched');
                                data.direction = id;
                                self.senddata(); // SOCKET
                                break;
                            case 'power':
                                ev.preventDefault();
                                if (confirm('ロボットを終了しますか？')) {
                                    socket.emit('power', 'POWEROFF');
                                }
                                break;
                            case 'sound':
                                ev.preventDefault();
                                if ($('#' + id).is('.touched')) {
                                    $('#' + id).removeClass('touched');
                                    socket.emit('sound', 'stop');
                                } else {
                                    $('#' + id).addClass('touched');
                                    socket.emit('sound', 'play');
                                }
                                break;
                            case 'introduction':
                                ev.preventDefault();
                                if ($('#' + id).is('.touched')) {
                                    $('#' + id).removeClass('touched');
                                    socket.emit('talk-stop', 'STOP');
                                } else {
                                    $('#' + id).addClass('touched');
                                    socket.emit('talk', {msg: MESSAGE_INTRODUCTION, handler: id});
                                }
                                break;
                            case 'test-voice':
                                ev.preventDefault();
                                if ($('#' + id).is('.touched')) {
                                    $('#' + id).removeClass('touched');
                                    socket.emit('talk-stop', 'STOP');
                                } else {
                                    $('#' + id).addClass('touched');
                                    socket.emit('talk', {msg: 'こんにちは', handler: id});
                                }
                                break;
                            case 'message-send':
                                ev.preventDefault();
                                if ($('#' + id).is('.touched')) {
                                    $('#' + id).removeClass('touched');
                                    socket.emit('talk-stop', 'STOP');
                                } else {
                                    $('#' + id).addClass('touched');
                                    socket.emit('talk', {msg: $('#message').val(), handler: id});
                                    $('#message').val('');
                                }
                                break;
                            case 'speed':
                            case 'raise':
                            case 'swing':
                            case 'message':
                                return;
                            case 'setangle':
                                ev.preventDefault;
                                data.raise = $('#raise').val();
                                data.swing = $('#swing').val();
                                self.senddata();
                                break;

                            default:
                                ev.preventDefault();
                        }
                        break;
                    case 'move':
                        if ($(ev.originalEvent.touches[0].target).attr('id') != 'speed') {
                            ev.preventDefault();
                        }
                        break;
                    case 'end':
                        if (data.direction == 'n') {
                            return;
                        }
                        $('#' + data.direction).removeClass('touched');
                        data.direction = 'n';
                        self.senddata(); // SOCKET
                        break;
                }


            }

            function prevent (ev) {
                ev.preventDefault();
            }

            // Prevent touch events
            $(doc).on(START, {evn: 'start'}, touchHandler);
            $(doc).on(MOVE, {evn: 'move'}, touchHandler);
            $(doc).on(END, {evn: 'end'}, touchHandler); 
            // Prevent gestures
            $(doc).on("gesturestart", prevent);
            $(doc).on("gesturechange", prevent);
            $(doc).on("gestureend", prevent);

            socket.on('talk-over', function (id) {
                $('#' + id).removeClass('touched');
            });

            data.speed = $('#speed').val();
            data.raise = $('#raise').val();
            data.swing = $('#swing').val();
            $('#speed').on('change', function () {
                data.speed = $(this).val();
                self.senddata();
            });

            self.senddata();

        },

        senddata: function () {
            socket.emit('data', data);
        }
};

    var self = smphController,
        el = self.elements,
        data = self.data;

    win.addEventListener("load", self.initialize, false);

});

