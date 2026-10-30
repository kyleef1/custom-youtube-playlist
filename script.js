
const playButton = document.getElementById("playButton");
const youtubeInput = document.getElementById("youtubeURL");
const videoContainer = document.getElementById("videoContainer");
const playlistElement = document.getElementById("playlist");
const nextButton = document.getElementById("nextButton");
const shuffleButton = document.getElementById("shuffleButton");

let shuffleEnabled = false;
let shuffleQueue = [];

let playlist = [];

try {
    const saved = localStorage.getItem("nintendoPlaylist");

    if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
            playlist = parsed.filter(song =>
                song &&
                typeof song.id === "string" &&
                /^[a-zA-Z0-9_-]{11}$/.test(song.id) &&
                typeof song.title === "string"
            );
        }
    }
} catch (error) {
    console.error("Could not load saved playlist:", error);
}

let currentSongIndex = -1;
let player = null;
let playerReady = false;
let pendingVideoID = null;

function onYouTubeIframeAPIReady() {
    if (player !== null) {
        return;
    }

    player = new YT.Player("youtubePlayer", {
        width: "100%",
        height: "390",
        playerVars: {
            playsinline: 1
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
}

// Initialize even if the API loaded before our callback
if (window.YT && window.YT.Player) {
    onYouTubeIframeAPIReady();
}


function onPlayerReady(event) {
    playerReady = true;

    if (pendingVideoID !== null) {
        event.target.loadVideoById(pendingVideoID);
        pendingVideoID = null;
    }
}

// Add a song to our playlist

playButton.addEventListener("click", async function() {
    const url = youtubeInput.value.trim();
    const videoID = getYouTubeVideoID(url);

    if (videoID === null) {
        alert("Please enter a valid YouTube URL.");
        return;
    }

    const song = {
        id: videoID,
        title: `Video ${videoID}`
    };

    playlist.push(song);
    savePlaylist();
    if (shuffleEnabled) {
    createShuffleQueue();
    }
    displayPlaylist();

    if (currentSongIndex === -1) {
        playSong(0);
    }

    youtubeInput.value = "";

    try {
        const videoURL =
            `https://www.youtube.com/watch?v=${videoID}`;

        const apiURL =
            `https://www.youtube.com/oembed?url=${encodeURIComponent(videoURL)}&format=json`;

        const response = await fetch(apiURL);

        if (!response.ok) {
            throw new Error("Could not retrieve video title");
        }

        const data = await response.json();

        song.title = data.title;
        savePlaylist();
        displayPlaylist();

    } catch (error) {
        console.warn("Title lookup failed:", error);
    }
});


// Display all songs

function displayPlaylist() {
    playlistElement.innerHTML = "";

    playlist.forEach(function(song, index) {
        const listItem = document.createElement("li");

        const songName = document.createElement("span");
        songName.textContent = song.title;

        songName.addEventListener("click", function() {
            playSong(index);
        });

        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.classList.add("remove-button");

        removeButton.addEventListener("click", function() {
            removeSong(index);
        });

        listItem.appendChild(songName);
        listItem.appendChild(removeButton);

        playlistElement.appendChild(listItem);
    });
}

// Remove a song from the playlist
function removeSong(index) {
    playlist.splice(index, 1);

    if (playlist.length === 0) {
        currentSongIndex = -1;
        if (playerReady && player) {
            player.stopVideo();
        }
        pendingVideoID = null;
    } else if (index === currentSongIndex) {
        currentSongIndex = -1;
        playSong(Math.min(index, playlist.length - 1));
    } else if (index < currentSongIndex) {
        currentSongIndex--;
    }
    if (shuffleEnabled) {
    createShuffleQueue();
    }
    savePlaylist();
    displayPlaylist();
}

// Play a selected song
function playSong(index) {
    if (index < 0 || index >= playlist.length) {
        return;
    }

    currentSongIndex = index;

    const videoID = playlist[index].id;

    if (playerReady && player) {
        player.loadVideoById(videoID);
    } else {
        pendingVideoID = videoID;
    }

    displayPlaylist();
}

// Play the next song in the playlist
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        playNextSong();
    }
}

// Shuffle the playlist
function shuffleArray(array) {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

// Create a shuffle queue excluding the currently playing song
function createShuffleQueue() {
    const indices = playlist.map((song, index) => index);

    // Exclude the currently playing song
    const remaining = indices.filter(
        index => index !== currentSongIndex
    );

    shuffleQueue = shuffleArray(remaining);
}

// Toggle shuffle mode
shuffleButton.addEventListener("click", function() {
    shuffleEnabled = !shuffleEnabled;

    if (shuffleEnabled) {
        createShuffleQueue();
        shuffleButton.textContent = "Shuffle: ON";
    } else {
        shuffleQueue = [];
        shuffleButton.textContent = "Shuffle: OFF";
    }
});


nextButton.addEventListener("click", playNextSong);

function playNextSong() {
    if (playlist.length === 0) {
        return;
    }

    let nextIndex;

    if (shuffleEnabled) {
        if (shuffleQueue.length === 0) {
            createShuffleQueue();
        }

        nextIndex = shuffleQueue.shift();

        if (nextIndex === undefined) {
            nextIndex = currentSongIndex;
        }
    } else {
        nextIndex = (currentSongIndex + 1) % playlist.length;
    }

    playSong(nextIndex);
}

// Extract the YouTube video ID
function getYouTubeVideoID(url) {
    try {
        const parsedURL = new URL(url);
        const hostname = parsedURL.hostname.toLowerCase();

        if (hostname === "youtu.be" ||
            hostname === "www.youtu.be") {
            return validateVideoID(
                parsedURL.pathname.split("/")[1]
            );
        }

        if (hostname === "youtube.com" ||
            hostname === "www.youtube.com" ||
            hostname === "m.youtube.com") {

            if (parsedURL.pathname === "/watch") {
                return validateVideoID(
                    parsedURL.searchParams.get("v")
                );
            }

            if (parsedURL.pathname.startsWith("/shorts/") ||
                parsedURL.pathname.startsWith("/embed/")) {
                return validateVideoID(
                    parsedURL.pathname.split("/")[2]
                );
            }
        }
    } catch (error) {
        return null;
    }

    return null;
}

function validateVideoID(id) {
    return /^[a-zA-Z0-9_-]{11}$/.test(id || "")
        ? id
        : null;
}


const exportButton = document.getElementById("exportButton");
const importButton = document.getElementById("importButton");
const importFile = document.getElementById("importFile");

exportButton.addEventListener("click", function() {
    if (playlist.length === 0) {
        alert("Your playlist is empty!");
        return;
    }

    const lines = [
        "# Nintendo Music Player Playlist",
        "# Format: VIDEO_ID | VIDEO_TITLE",
        ""
    ];

    playlist.forEach(function(song) {
        const title = song.title
            .replace(/[\r\n|]+/g, " ")
            .trim();

        lines.push(`${song.id} | ${title}`);
    });

    const fileContent = lines.join("\n");

    const blob = new Blob([fileContent], {
        type: "text/plain;charset=utf-8"
    });

    const downloadURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadURL;
    
    const playlistName = prompt(
        "Enter a name for your playlist:",
        "my playlist"
    );

    if (playlistName === null) {
        URL.revokeObjectURL(downloadURL);
        return;
    }

    const safeName = playlistName
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .trim() || "Nintendo Music Collection";

    link.download = `${safeName}.txt`;


    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadURL);
});


importButton.addEventListener("click", function() {
    importFile.click();
});

importFile.addEventListener("change", async function() {
    const file = importFile.files[0];

    if (!file) {
        return;
    }

    
if (file.size > 1024 * 1024) {
    alert("Playlist file is too large. Maximum size is 1 MB.");
    importFile.value = "";
    return;
}

    try {
        const content = await file.text();
        const lines = content.split(/\r?\n/);

        const importedSongs = [];

        lines.forEach(function(line) {
            line = line.trim();

            if (!line || line.startsWith("#")) {
                return;
            }

            const separator = line.indexOf("|");

            if (separator === -1) {
                return;
            }

            const id = line.substring(0, separator).trim();
            const title = line.substring(separator + 1).trim();

            if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
                return;
            }

            if (!title) {
                return;
            }

            importedSongs.push({ id, title });
        });

        if (importedSongs.length === 0) {
            alert("No valid songs found in this file.");
            return;
        }

        const replace = confirm(
            "Replace your current playlist?\n\n" +
            "OK = Replace\n" +
            "Cancel = Add imported songs"
        );

        
        if (replace) {
            if (playerReady && player) {
                player.stopVideo();
            }

            playlist = importedSongs;
            currentSongIndex = -1;
            pendingVideoID = null;
        } else {
            playlist.push(...importedSongs);
        }

        savePlaylist();

        if (playlist.length > 0 && currentSongIndex === -1) {
            playSong(0);
        }

        if (shuffleEnabled) {
            createShuffleQueue();
        }

        displayPlaylist();

        alert(`Imported ${importedSongs.length} songs!`);

    } catch (error) {
        console.error("Import failed:", error);
        alert("Could not read the playlist file.");
    } finally {
        importFile.value = "";
    }
});

function savePlaylist() {
    try {
        localStorage.setItem(
            "nintendoPlaylist",
            JSON.stringify(playlist)
        );
    } catch (error) {
        console.error("Could not save playlist:", error);
    }
}

// Load the playlist from localStorage
function onPlayerError(event) {
    console.warn(
        "YouTube playback error:",
        event.data
    );

    const song = playlist[currentSongIndex];

    if (song) {
        console.warn(
            "Unavailable video:",
            song.title,
            song.id
        );
    }
}

// Restore the saved playlist visually
displayPlaylist();