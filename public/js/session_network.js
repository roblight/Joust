"use strict";

window.network = {
  attachNetworkHandlers: (meta) => {
    let socket = meta.socket;
    let room_id = meta.roomId;

    socket.on("disconnect", window.utils.leaveRoom);
    socket.on("game_update", updateGameState);
    window.currentGameState = null;

    return new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('join', {"room_id": room_id});
        resolve(meta);
      });
    });
  },

  attachSocket: (meta) => {
    let room_id = meta.roomId;
    meta.socket = io.connect('http://' + document.domain + ':' + location.port);
    return meta;
  },

  attachPlayerId: (meta) => {
    meta.playerId = meta.socket.id;
    return meta;
  },

  attachOffset: (meta) => {
    let socket = meta.socket;
    let offsets = [];
    let t0 = window.utils.getTimestampMilliseconds();
    socket.emit("synchronize");

    return new Promise((resolve, reject) => {
      let asyncIncrement = window.utils.async(10, () => {
        socket.off("synchronize_ack");
        console.log(offsets);
        window.meta.averageOffset = offsets.reduce((a, b) => a + b, 0) / 10;
        resolve(meta);
      });

      socket.on("synchronize_ack", (data) => {
        let t1 = data["timestamp"];
        let t2 = data["timestamp"];
        let t3 = window.utils.getTimestampMilliseconds();
        offsets.push(((t1 - t0) + (t2 - t3)) / 2);

        t0 = window.utils.getTimestampMilliseconds();
        asyncIncrement();
        socket.emit("synchronize");
      });
    });
  }
}


function updateGameState(data) {
  console.log(data);
  updatePlayerList(data);
  updateMusic(data);
  window.currentGameState = data;
}

// ====

function updatePlayerList(data) {
  let room = data["room"];
  let players = room["players"];
  let playerId = window.meta.playerId;
  let currentPlayer = players[playerId];

  let slots = [
    document.getElementById("three"),
    document.getElementById("two"),
    document.getElementById("one")
  ];
  let characters = ["red", "blue", "yellow", "green"];

  // TODO: find a way to templatize this
  document.getElementById("you").className = characters[currentPlayer["character"]];
  document.getElementById("you").innerHTML = "<img class=\"char_img_main\" src=../assets/"+characters[currentPlayer["character"]]+".png >";
  document.getElementById("you").innerHTML += "<img class=\"char_img_status\" src=../assets/"+currentPlayer["status_readable"]+".png>";


  slots.forEach((elem) => {
    elem.innerHTML = "";
    elem.className = "character";
  });

  for (let id in players) {
    if (id != playerId) {
      let slot = slots.pop();
      slot.className = "character " + characters[players[id]["character"]];
      slot.innerHTML = "<img class=\"char_img_status\" src=../assets/"+players[id]["status_readable"]+".png>"
      slot.innerHTML += "<img class=\"char_img\" src=../assets/"+characters[players[id]["character"]]+".png>"
    }
  }
}

function updateMusic(data) {
  if (window.utils.roomIsPlaying(data) &&
    window.utils.currentPlayerIsPlaying(data) &&
    window.utils.sessionIsSlow(data) &&
    !window.utils.sessionIsSlow(window.currentGameState)) {
    stopMusic();
    playMusic("slow");
  }
  else if (window.utils.roomIsPlaying(data) &&
    window.utils.currentPlayerIsPlaying(data) &&
    window.utils.sessionIsFast(data) &&
    !window.utils.sessionIsFast(window.currentGameState)) {
    stopMusic();
    playMusic("fast");
  }
  else if (!window.utils.roomIsPlaying(data) &&
    window.utils.roomIsPlaying(window.currentGameState) &&
    data["room"]["last_winner_id"] == window.meta.playerId) {
    // winner
    stopMusic();
    console.log("WINNER!");
  }
  else if (window.utils.currentPlayerIsPlaying(window.currentGameState) &&
    !window.utils.currentPlayerIsPlaying(data)) {
    // just eliminated
    stopMusic();
    console.log("LOSER");
  }
  else if (!window.utils.roomIsPlaying(data) ||
    !window.utils.currentPlayerIsPlaying(data)) {
    stopMusic();
  }
  else {
    console.log("music update passthrough");
  }
}

// ====

function playMusic(type) {
  let audioCtx = window.meta.audioCtx;
  window.meta.music.status = "loading";

  let whiteNoise = window.meta.audioCtx.createBufferSource();
  whiteNoise.buffer = window.meta.music.white;
  let gainNode = window.meta.audioCtx.createGain();
  gainNode.gain.value = 0.3;
  whiteNoise.connect(gainNode);
  gainNode.connect(window.meta.audioCtx.destination);
  whiteNoise.loop = true;
  whiteNoise.start();

  let musicSource = audioCtx.createBufferSource();
  let musicData = (type === "slow") ? window.meta.music.slow[0] : window.meta.music.fast[0];
  musicSource.buffer = musicData;
  musicSource.connect(audioCtx.destination);
  window.meta.audioSource = musicSource;

  console.log(audioCtx.currentTime);
  whiteNoise.stop(audioCtx.currentTime + 0.3);
  musicSource.start(audioCtx.currentTime + 0.3, (-window.meta.averageOffset / 1000) + 0.3);
}

function stopMusic() {
  let audioSource = window.meta.audioSource;
  window.meta.music.status = "stopped";
  if (audioSource != null) {
    try {
      audioSource.stop();
    } catch(err) {
      console.log(err);
    }
  }
  audioSource = null;
}
