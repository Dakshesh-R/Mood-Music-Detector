const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const container = document.querySelector(".video-container");
const qrCodeContainer = document.getElementById("qrCodeContainer");

let detectionInterval = null;
let stream = null;
let maxKey = null;

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
  faceapi.nets.faceExpressionNet.loadFromUri("./models"),
  faceapi.nets.ageGenderNet.loadFromUri("./models"),
]).then(() => {
  console.log("Models loaded.");
  startBtn.disabled = false;
});

function startWebcam(callback) {
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((mediaStream) => {
      stream = mediaStream;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        if (callback) callback();
      };
    })
    .catch((err) => {
      console.error("Error accessing webcam: ", err);
    });
}

function stopWebcam() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    stream = null;
  }
}

function startDetection() {
  const canvas = faceapi.createCanvasFromMedia(video);
  container.innerHTML = "";
  container.appendChild(video);
  container.appendChild(canvas);

  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";

  faceapi.matchDimensions(canvas, {
    width: video.width,
    height: video.height,
  });

  detectionInterval = setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();

    const resized = faceapi.resizeResults(detections, {
      width: video.width,
      height: video.height,
    });

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);
    faceapi.draw.drawFaceExpressions(canvas, resized);

    if (resized[0]) {
      const expressions = resized[0].expressions;
      let maxValue = -Infinity;
      for (const key in expressions) {
        if (expressions[key] > maxValue) {
          maxValue = expressions[key];
          maxKey = key;
        }
      }

      console.log(`Mood: ${maxKey} (${Math.round(maxValue * 100)}%)`);
    }
  }, 1000);

  setTimeout(() => {
    stopDetection();
    stopWebcam();
    replaceWithEmoji();
    restartBtn.classList.remove("d-none");
    startBtn.classList.add("d-none");
    console.log("Detection and camera stopped after 5 seconds.");
  }, 5000);
}

function stopDetection() {
  clearInterval(detectionInterval);
}

function updateBackground(mood) {
  const body = document.body;
  const classList = body.classList;

  classList.remove(
    "bg-default",
    "bg-happy",
    "bg-sad",
    "bg-angry",
    "bg-neutral",
    "bg-surprised",
    "bg-fearful",
    "bg-disgusted"
  );

  classList.add("transition-bg");

  switch (mood) {
    case "happy":
      classList.add("bg-happy");
      break;
    case "sad":
      classList.add("bg-sad");
      break;
    case "angry":
      classList.add("bg-angry");
      break;
    case "neutral":
      classList.add("bg-neutral");
      break;
    case "surprised":
      classList.add("bg-surprised");
      break;
    case "fearful":
      classList.add("bg-fearful");
      break;
    case "disgusted":
      classList.add("bg-disgusted");
      break;
    default:
      classList.add("bg-default");
  }
}

function replaceWithEmoji() {
  const img = document.createElement("img");

  if (maxKey !== null && maxKey !== undefined && maxKey.trim() !== "") {
    document.querySelector("h5").innerHTML = `${maxKey.charAt(0).toUpperCase() + maxKey.slice(1)}`;

    img.src = `./emojis/${maxKey}.gif`;
    img.alt = maxKey;

    container.innerHTML = "";
    container.appendChild(img);

    updateBackground(maxKey);
    populateDropdown();
  } else {
    document.querySelector("h5").innerHTML = `No mood detected`;
    console.log("No mood detected, so no emoji displayed.");
  }
}

startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  startWebcam(() => {
    startDetection();
  });
});

restartBtn.addEventListener("click", () => {
  stopDetection();
  stopWebcam();
  startWebcam(() => {
    startDetection();
  });

  restartBtn.classList.add("d-none");
  startBtn.classList.remove("d-none");
  startBtn.disabled = false;
});

function getRandomSubset(array, size) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

async function populateDropdown() {
  try {
    if (!maxKey) return;

    const response = await fetch('./songs.json');
    const allSongs = await response.json();
    const moodSongs = allSongs[maxKey] || [];

    const dropdown = document.getElementById("songDropdown");
    dropdown.innerHTML = '';
    qrCodeContainer.innerHTML = '';

    if (moodSongs.length === 0) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="dropdown-item text-muted">No songs available for ${maxKey}</span>`;
      dropdown.appendChild(li);
      return;
    }

    const randomSongs = getRandomSubset(moodSongs, 5);

    randomSongs.forEach((song) => {
      const li = document.createElement("li");
      li.innerHTML = `<a class="dropdown-item" href="${song.url}" target="_blank">${song.name} – ${song.artists}</a>`;
      li.addEventListener("click", (e) => {
        e.preventDefault();
        generateQRCode(song.url);
        window.open(song.url, '_blank');
      });
      dropdown.appendChild(li);
    });
  } catch (err) {
    console.error('Error loading songs from local JSON:', err);
  }
}

function generateQRCode(url) {
  qrCodeContainer.innerHTML = '';

  const qr = new QRCodeStyling({
    width: 500,
    height: 500,
    type: "canvas",
    data: url,
    dotsOptions: {
      color: "#000",
      type: "rounded"
    },
    backgroundOptions: {
      color: "#fff"
    }
  });

  container.appendChild(qrCodeContainer);

  Object.assign(qrCodeContainer.style, {
    position: "absolute",
    top: "0%",
    left: "15%",
    transform: "translateX(-50%)",
    zIndex: "9999",
    backgroundColor: "white",
    padding: "10px",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  });

  qr.append(qrCodeContainer);
}