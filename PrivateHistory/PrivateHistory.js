(function reloadUntilMainRoom() {
  // Scoping
  if (
      wgCanonicalSpecialPageName != 'Chat' ||
      !window.Promise ||
      window.PrivateHistory && window.PrivateHistory.init
  ) return;

  // Check for mainRoom availability
  if (!window.mainRoom || !window.mainRoom.isInitialized) {
      setTimeout(reloadUntilMainRoom, 500);
      return;
  }

  window.PrivateHistory = window.PrivateHistory || {};
  PrivateHistory.timeouts = {};
  PrivateHistory.avatars = {};
  PrivateHistory.rooms = {};
  PrivateHistory.chats = {};
  PrivateHistory.logs = {};
  PrivateHistory.init = true;
  PrivateHistory.frag = document.createDocumentFragment();

  // Used in .filter
  function starts_with(string) {
      return function(item) {
          return item.slice(0, string.length) == string;
      };
  }

  function not_equal(string) {
      return function(item) {
          return item != string;
      };
  }

  // Bind a function to new private rooms
  function bind_new_private(fn, wait) {
      mainRoom.model.privateUsers.bind('add', function(user) {
          var id = user.attributes.roomId,
          room = mainRoom.chats.privates[id];

          if (room.isInitialized || wait === false) {
              fn(room);
          } else {
              // Wait until previous messages are loaded
              room.socket.bind('initial', function() {
                  fn(room);
              });
          }
      });
  }

  // Bind a function to afteradd events on private rooms
  function bind_private_messages(fn) {
      var privates = mainRoom.chats.privates;
      for (var key in privates) {
          privates[key].model.chats.bind('afteradd', fn);
      }

      bind_new_private(function(room) {
          room.model.chats.bind('afteradd', fn);
      }, false);
  }

  // Bind a function to users entering the chat and run it on users that are already in chat
  function bind_users_join(fn) {
      mainRoom.model.users.models.forEach(fn);
      mainRoom.model.users.bind('add', fn);
  }

  // Saves avatar into persistent storage
  function save_avatar(user) {
      PrivateHistory.avatars[user.attributes.name] = user.attributes.avatarSrc;
  }

  // Called individually per logs store
  function save_logs(key) {
      localforage.getItem(key).then(function(chats) {
          var users = key.slice('PrivateHistory-'.length);

          PrivateHistory.logs[users] = chats;
      }).catch(console.log);
  }

  // Gets logs and stores them in the main object
  function get_logs() {
      localforage.keys().then(function(keys) {
          keys
              .filter(starts_with('PrivateHistory-'))
              .forEach(save_logs);
      }).catch(console.log);
  }

  // Get member list separated by |, cannot be called on mainRoom
  function get_room_key(room) {
      if (room === mainRoom) throw new Error('Cannot call get_room_key on mainRoom');

      return room.model.privateRoom.attributes.users.filter(not_equal(wgUserName)).sort().join('|');
  }

  // Get array with necessary message info for storage
  function get_message_entry(message) {
      var a = message.attributes,
      room = get_message_room(message),
      keys = get_room_key(room).split('|'),
      time = Math.floor(a.timeStamp / 1000),
      name = a.name,
      text = a.text,
      from = keys.indexOf(name) + 1;

      return [time, from, text];
  }

  // Get the room the message entry was sent in
  function get_message_room(message) {
      var id = message.attributes.roomId;

      return mainRoom.chats.privates[id] || mainRoom;
  }

  // Queue new chat entry on user's local storage
  function queue_message_store(message) {
      var entry = get_message_entry(message),
      room = get_message_room(message),
      key = get_room_key(room),
      logs = PrivateHistory.logs[key] = PrivateHistory.logs[key] || [],
      chats = PrivateHistory.chats[key] = PrivateHistory.chats[key] || [],
      i = logs.length,
      duplicate,
      log;

      while (i--) {
          log = logs[i];
          if (log[0] == entry[0] && log[1] == entry[1] && log[2] == entry[2]) {
              duplicate = true;
              break;
          }
          if (log[0] < entry[0]) break;
      }

      chats.push(entry);

      if (duplicate) return;

      logs.push(entry);

      if (PrivateHistory.timeouts[key]) return;

      PrivateHistory.timeouts[key] = setTimeout(function() {
          delete PrivateHistory.timeouts[key];

          store_logs(key);
      }, 10000);
  }

  // Submit the logs to user storage
  function store_logs(key) {
      localforage.setItem('PrivateHistory-' + key, PrivateHistory.logs[key]).catch(console.log);
  }

  // Filter duplicates between two chat entry arrays
  function filter_duplicates(logs, chats) {
      return logs.filter(function(log) {
          var i = chats.length;
          while (i--) {
              var chat = chats[i];
              if (chat[0] == log[0] && chat[1] == log[1] && chat[2] == log[2]) return false;
          }
          return true;
      });
  }

  // Return a single chat view from a chat entry
  function get_message(entry, users) {
      var name = users[entry[1]];
      return new models.ChatEntry({
          timeStamp: entry[0] * 1000,
          name: name,
          text: entry[2],
          avatarSrc: PrivateHistory.avatars[name] || ''
      });
  }

  // Base rendering of logs into a sandboxed document fragment. Calls itself until it finishes iterating over the given array
  function base_render_logs(entries, fake, users, callback, index) {
      index = index || 0;
      var entry = entries[index],
      d = Date.now();
      if (!entry) return callback();

      fake.model.chats.add(get_message(entry, users));

      setTimeout(function() {
          base_render_logs(entries, fake, users, callback, index + 1);
      }, Date.now() - d + 1);
  }

  // Render private
  function render_logs(entries, room, callback) {
      var key = get_room_key(room),
      users = [wgUserName].concat(key.split('|')),
      fake = PrivateHistory.rooms[key],
      elem = fake.viewDiscussion.chatUL.get(0),
      room_elem = room.viewDiscussion.chatUL.get(0);

      fake.model.chats.add(get_message([
          Date.now(),
          1,
          'this is to break continued messages'
      ], ['WikiaBot']));
      elem.removeChild(elem.lastElementChild);

      base_render_logs(entries, fake, users, function() {
          var first = room_elem.firstElementChild,
          last = elem.lastElementChild,
          height = room_elem.scrollHeight;

          if (first && last && first.getAttribute('data-user') == last.getAttribute('data-user')) {
              first.classList.add('continued');
          }

          while (elem.lastElementChild) {
              room_elem.insertBefore(elem.lastElementChild, room_elem.firstElementChild);
          }

          room_elem.parentElement.scrollTop += room_elem.scrollHeight - height;

          callback();
      });
  }

  // Load private history and display it
  function load_messages(room) {
      var key = get_room_key(room),
      logs = PrivateHistory.logs[key];

      if (!logs || room.adding) return;

      room.adding = true;

      var fake = PrivateHistory.rooms[key],
      chats = PrivateHistory.chats[key] = PrivateHistory.chats[key] || [],
      filtered = filter_duplicates(logs, chats).slice(-50);

      if (!filtered.length) {
          console.log('nologs');
          room.adding = false;
          return;
      }

      render_logs(filtered, room, function() {
          PrivateHistory.chats[key] = filtered.concat(chats);
          room.adding = false;
      });
  }

  // Bind events to a private room
  function bind_events(room) {
      var scrolling = room.viewDiscussion.chatDiv.get(0),
      key = get_room_key(room),
      fake = PrivateHistory.rooms[key] = new NodeRoomController(-room.roomId);

      fake.original = room;

      PrivateHistory.frag.appendChild(fake.viewDiscussion.chatDiv.get(0));

      scrolling.addEventListener('scroll', function() {
          if (scrolling.scrollTop === 0) {
              load_messages(room);
          }
      }, {
          passive: true // At this point, if you see a scroll listener without passive, you should shoot your dev
      });

      if (scrolling.scrollTop === 0) {
          load_messages(room);
      }
  }

  // Startup function
  function init() {
      define.amd = old;
      if (typeof localforage != 'object') {
          console.log('localForage did not load. Aborting PrivateHistory...');
          return;
      }

      // Set storage config
      localforage.config({
          name        : 'PrivateHistory',
          version     : 1.0,
          storeName   : 'keyvaluepairs',
          description : 'private messaging history'
      });

      // Get logs
      get_logs();

      // Bind events
      bind_users_join(save_avatar);
      bind_private_messages(queue_message_store);
      bind_new_private(bind_events);
  }

  var old = define.amd;
  delete define.amd;
  var script = importScriptURI('https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.5/localforage.min.js');

  if (script) {
      script.onload = init;
  } else {
      init();
  }
})();