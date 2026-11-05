import './style.css';
import * as THREE from 'three';

import {
  CSS3DRenderer,
  CSS3DObject
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';

import {
  TrackballControls
} from 'three/examples/jsm/controls/TrackballControls.js';


// ==========================================
// 1. GOOGLE CONFIGURATION
// ==========================================

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const SPREADSHEET_ID =
  import.meta.env.VITE_GOOGLE_SPREADSHEET_ID;

const SHEET_RANGE =
  import.meta.env.VITE_GOOGLE_SHEET_RANGE ||
  'Data!A1:G201';

const SHEETS_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets.readonly';


// ==========================================
// 2. DOM ELEMENTS
// ==========================================

const container =
  document.querySelector('#scene-container');

const loading =
  document.querySelector('#loading');

const signInButton =
  document.querySelector('#signin-button');

const detailPanel =
  document.querySelector('#detail-panel');

const detailContent =
  document.querySelector('#detail-content');

const closeDetailButton =
  document.querySelector('#close-detail');


// ==========================================
// 3. THREE.JS INITIALIZATION
// ==========================================

const scene = new THREE.Scene();

scene.background = null;


const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth /
    container.clientHeight,
  1,
  10000
);

camera.position.set(
  0,
  0,
  2200
);


// ------------------------------------------
// CSS3D Renderer
// ------------------------------------------

const renderer = new CSS3DRenderer();

renderer.setSize(
  container.clientWidth,
  container.clientHeight
);

renderer.domElement.style.position =
  'absolute';

renderer.domElement.style.inset =
  '0';

container.appendChild(
  renderer.domElement
);


// ------------------------------------------
// Trackball Controls
// ------------------------------------------

const controls =
  new TrackballControls(
    camera,
    renderer.domElement
  );

controls.rotateSpeed = 1.15;

controls.minDistance = 500;

controls.maxDistance = 6000;


// ------------------------------------------
// Root object
// ------------------------------------------

const root =
  new THREE.Group();

scene.add(root);


// ==========================================
// 4. APPLICATION STATE
// ==========================================

let records = [];

let objects = [];

let activeLayout = 'table';

let tokenClient = null;

let accessToken = null;


// ------------------------------------------
// Layout targets
// ------------------------------------------

const targets = {
  table: [],
  sphere: [],
  helix: [],
  grid: []
};


// ==========================================
// HELPERS
// ==========================================

const fmtMoney = n =>
  new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }
  ).format(n);


const escapeHtml = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );


// ==========================================
// 5. CSV PARSER
// ==========================================

function parseCsv(text) {

  const rows = [];

  let row = [];

  let field = '';

  let quoted = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const c = text[i];

    const next = text[i + 1];


    if (
      c === '"' &&
      quoted &&
      next === '"'
    ) {

      field += '"';

      i++;

    }

    else if (c === '"') {

      quoted = !quoted;

    }

    else if (
      c === ',' &&
      !quoted
    ) {

      row.push(field);

      field = '';

    }

    else if (
      (c === '\n' ||
       c === '\r') &&
      !quoted
    ) {

      if (
        c === '\r' &&
        next === '\n'
      ) {
        i++;
      }


      row.push(field);


      if (
        row.some(
          v => v.trim()
        )
      ) {
        rows.push(row);
      }


      row = [];

      field = '';

    }

    else {

      field += c;

    }
  }


  if (
    field.length ||
    row.length
  ) {

    row.push(field);

    rows.push(row);

  }


  const headers =
    (
      rows.shift() || []
    ).map(
      x =>
        x
          .replace(/^\uFEFF/, '')
          .trim()
    );


  return rows.map(r =>
    Object.fromEntries(
      headers.map(
        (h, i) => [
          h,
          r[i] ?? ''
        ]
      )
    )
  );
}


// ==========================================
// 6. DATA NORMALIZATION
// ==========================================

function normalize(row) {

  const get = (...keys) => {

    for (const k of keys) {

      const found =
        Object.keys(row).find(
          x =>
            x
              .trim()
              .toLowerCase() ===
            k.toLowerCase()
        );

      if (found) {
        return row[found];
      }
    }

    return '';
  };


  const raw =
    String(
      get(
        'Net Worth',
        'NetWorth'
      )
    )
      .replace(
        /[$,\s]/g,
        ''
      );


  return {

    name: get('Name'),

    photo: get('Photo'),

    age: get('Age'),

    country: get('Country'),

    interest: get('Interest'),

    netWorth:
      Number(raw) || 0

  };
}


function worthBand(n) {

  if (n < 100000) {
    return 'red';
  }

  if (n <= 200000) {
    return 'orange';
  }

  return 'green';
}


// ==========================================
// 7. PROFILE POPUP
// ==========================================

function showDetails(person) {

  if (!person) {
    return;
  }


  // IMPORTANT:
  // Keep TrackballControls disabled while
  // the profile popup is open.
  controls.enabled = false;


  detailContent.innerHTML = `

    <img
      src="${escapeHtml(person.photo)}"
      alt=""
      onerror="this.style.display='none'"
    >

    <h3>
      ${escapeHtml(person.name)}
    </h3>

    <p>
      ${escapeHtml(person.age)}
      years ·
      ${escapeHtml(person.country)}
    </p>

    <p>
      Interest:
      ${escapeHtml(person.interest)}
    </p>

    <div
      class="worth"
      style="color:${
        worthBand(person.netWorth) === 'red'
          ? '#ff9ca4'
          : worthBand(person.netWorth) === 'orange'
            ? '#ffc27f'
            : '#83e7bd'
      }"
    >
      ${fmtMoney(person.netWorth)}
    </div>

  `;


  detailPanel.classList.add(
    'open'
  );

  detailPanel.setAttribute(
    'aria-hidden',
    'false'
  );
}


// ==========================================
// CLOSE PROFILE
// ==========================================

function closeDetails() {

  detailPanel.classList.remove(
    'open'
  );

  detailPanel.setAttribute(
    'aria-hidden',
    'true'
  );


  // IMPORTANT:
  // Only allow camera movement again
  // after the popup is closed.
  controls.enabled = true;
}


closeDetailButton.addEventListener(
  'click',
  event => {

    event.preventDefault();

    event.stopPropagation();

    closeDetails();

  }
);


// ==========================================
// PREVENT POPUP FROM INTERACTING WITH
// TRACKBALL CONTROLS
// ==========================================

detailPanel.addEventListener(
  'pointerdown',
  event => {

    event.stopPropagation();

    controls.enabled = false;

  }
);


detailPanel.addEventListener(
  'pointermove',
  event => {

    event.stopPropagation();

  }
);


detailPanel.addEventListener(
  'pointerup',
  event => {

    event.stopPropagation();

  }
);


// ==========================================
// 8. PROFILE TILE CREATION
// ==========================================

function makeTile(
  person,
  index
) {

  const el =
    document.createElement(
      'div'
    );


  el.className =
    `tile ${worthBand(
      person.netWorth
    )}`;


  el.dataset.index =
    String(index);


  el.innerHTML = `

    <img
      class="tile-photo"
      src="${escapeHtml(person.photo)}"
      alt=""
      loading="lazy"
      draggable="false"
      onerror="this.style.visibility='hidden'"
    >

    <div
      class="tile-name"
      title="${escapeHtml(person.name)}"
    >
      ${escapeHtml(person.name)}
    </div>

    <div class="tile-meta">
      ${escapeHtml(person.age)}
      ·
      ${escapeHtml(person.country)}
    </div>

    <div class="tile-interest">
      ${escapeHtml(person.interest)}
    </div>

    <div class="tile-worth">
      ${fmtMoney(person.netWorth)}
    </div>

  `;


  // ========================================
  // PROFILE POINTER STATE
  //
  // IMPORTANT:
  // These variables belong to THIS tile only.
  // Do not make them global.
  // ========================================

  let pointerDown = false;

  let pointerMoved = false;

  let startX = 0;

  let startY = 0;

  let activePointerId = null;


  el.style.cursor =
    'pointer';

  el.style.touchAction =
    'none';


  // ----------------------------------------
  // POINTER DOWN
  // ----------------------------------------

  el.addEventListener(
    'pointerdown',
    event => {

      // Only primary mouse button
      if (
        event.pointerType === 'mouse' &&
        event.button !== 0
      ) {
        return;
      }


      event.preventDefault();

      event.stopPropagation();


      pointerDown = true;

      pointerMoved = false;

      activePointerId =
        event.pointerId;


      startX =
        event.clientX;

      startY =
        event.clientY;


      // --------------------------------------
      // CRITICAL FIX
      //
      // TrackballControls must NOT see the
      // same pointerdown event.
      // --------------------------------------

      controls.enabled = false;


      // --------------------------------------
      // Keep receiving events even when the
      // pointer leaves the profile tile.
      // --------------------------------------

      try {

        el.setPointerCapture(
          event.pointerId
        );

      } catch (error) {

        console.warn(
          'Could not capture pointer:',
          error
        );

      }

    }
  );


  // ----------------------------------------
  // POINTER MOVE
  // ----------------------------------------

  el.addEventListener(
    'pointermove',
    event => {

      if (
        !pointerDown ||
        event.pointerId !==
          activePointerId
      ) {
        return;
      }


      event.preventDefault();

      event.stopPropagation();


      const distanceX =
        Math.abs(
          event.clientX -
          startX
        );


      const distanceY =
        Math.abs(
          event.clientY -
          startY
        );


      // --------------------------------------
      // 8px dead zone
      //
      // Small mouse movements are still
      // considered a click.
      // --------------------------------------

      if (
        distanceX > 8 ||
        distanceY > 8
      ) {

        pointerMoved = true;

      }

    }
  );


  // ----------------------------------------
  // POINTER UP
  // ----------------------------------------

  el.addEventListener(
    'pointerup',
    event => {

      if (
        !pointerDown ||
        event.pointerId !==
          activePointerId
      ) {
        return;
      }


      event.preventDefault();

      event.stopPropagation();


      pointerDown = false;


      // --------------------------------------
      // Release pointer capture
      // --------------------------------------

      try {

        if (
          el.hasPointerCapture(
            event.pointerId
          )
        ) {

          el.releasePointerCapture(
            event.pointerId
          );

        }

      } catch (error) {

        console.warn(
          'Could not release pointer:',
          error
        );

      }


      activePointerId =
        null;


      // --------------------------------------
      // IF USER DRAGGED
      //
      // Do NOT open profile.
      //
      // Re-enable TrackballControls because
      // the user did not click the profile.
      // --------------------------------------

      if (pointerMoved) {

        pointerMoved = false;

        controls.enabled = true;

        return;

      }


      // --------------------------------------
      // REAL CLICK
      // --------------------------------------

      const selectedIndex =
        Number(
          el.dataset.index
        );


      if (
        Number.isInteger(
          selectedIndex
        ) &&
        records[selectedIndex]
      ) {

        // IMPORTANT:
        // showDetails() keeps controls
        // disabled while popup is open.
        showDetails(
          records[selectedIndex]
        );

      }


      pointerMoved = false;

    }
  );


  // ----------------------------------------
  // POINTER CANCEL
  // ----------------------------------------

  el.addEventListener(
    'pointercancel',
    event => {

      if (
        event.pointerId !==
        activePointerId
      ) {
        return;
      }


      event.preventDefault();

      event.stopPropagation();


      pointerDown = false;

      pointerMoved = false;

      activePointerId =
        null;


      try {

        if (
          el.hasPointerCapture(
            event.pointerId
          )
        ) {

          el.releasePointerCapture(
            event.pointerId
          );

        }

      } catch (error) {

        console.warn(
          'Could not release pointer:',
          error
        );

      }


      // Cancelled interaction means
      // normal camera controls can resume.
      controls.enabled = true;

    }
  );


  // ----------------------------------------
  // POINTER LEAVE
  //
  // Do NOT cancel here.
  //
  // Pointer capture handles this correctly.
  // ----------------------------------------


  // ----------------------------------------
  // Prevent image dragging
  // ----------------------------------------

  el.addEventListener(
    'dragstart',
    event => {

      event.preventDefault();

      event.stopPropagation();

    }
  );


  return el;
}


// ==========================================
// 9. LAYOUT TARGETS
// ==========================================

function makeTargets() {

  const n =
    objects.length;


  // ========================================
  // TABLE: 20 x 10
  // ========================================

  for (
    let i = 0;
    i < n;
    i++
  ) {

    const col =
      i % 20;

    const row =
      Math.floor(i / 20);


    const o =
      new THREE.Object3D();


    o.position.set(

      (col - 9.5) * 132,

      (4.5 - row) * 166,

      0

    );


    targets.table[i] =
      o;
  }


  // ========================================
  // SPHERE
  // ========================================

  for (
    let i = 0;
    i < n;
    i++
  ) {

    const phi =
      Math.acos(
        -1 +
        2 * (i + 0.5) / n
      );


    const theta =
      Math.sqrt(
        n * Math.PI
      ) * phi;


    const o =
      new THREE.Object3D();


    o.position.set(

      780 *
        Math.cos(theta) *
        Math.sin(phi),

      780 *
        Math.sin(theta) *
        Math.sin(phi),

      780 *
        Math.cos(phi)

    );


    o.lookAt(
      o.position
        .clone()
        .multiplyScalar(2)
    );


    targets.sphere[i] =
      o;
  }


  // ========================================
  // DOUBLE HELIX
  // ========================================

  for (
    let i = 0;
    i < n;
    i++
  ) {

    const strand =
      i % 2;


    const step =
      Math.floor(i / 2);


    const perStrand =
      Math.ceil(n / 2);


    const t =
      step /
        perStrand *
        Math.PI *
        8 +
      strand * Math.PI;


    const o =
      new THREE.Object3D();


    o.position.set(

      420 *
        Math.cos(t),

      (
        (
          step /
          (
            perStrand - 1 ||
            1
          )
        ) -
        0.5
      ) * 1500,

      420 *
        Math.sin(t)

    );


    o.lookAt(

      o.position
        .clone()
        .add(
          new THREE.Vector3(
            -Math.sin(t),
            0.15,
            Math.cos(t)
          )
        )

    );


    targets.helix[i] =
      o;
  }


  // ========================================
  // GRID: 5 x 4 x 10
  // ========================================

  for (
    let i = 0;
    i < n;
    i++
  ) {

    const x =
      i % 5;


    const y =
      Math.floor(i / 5) % 4;


    const z =
      Math.floor(i / 20);


    const o =
      new THREE.Object3D();


    o.position.set(

      (x - 2) * 250,

      (1.5 - y) * 250,

      (z - 4.5) * 190

    );


    targets.grid[i] =
      o;
  }
}


// ==========================================
// 10. LAYOUT TRANSITIONS
// ==========================================

function transform(layout) {

  activeLayout =
    layout;


  document
    .querySelectorAll(
      '.layout'
    )
    .forEach(button => {

      button.classList.toggle(
        'active',
        button.dataset.layout ===
          layout
      );

    });


  const from =
    objects.map(o => ({

      p:
        o.position.clone(),

      q:
        o.quaternion.clone()

    }));


  const start =
    performance.now();


  const duration =
    950;


  function animateMove(now) {

    const t =
      Math.min(
        1,
        (now - start) /
          duration
      );


    const e =
      t < 0.5

        ? 4 * t * t * t

        : 1 -
          Math.pow(
            -2 * t + 2,
            3
          ) / 2;


    objects.forEach(
      (o, i) => {

        const target =
          targets[layout][i];


        o.position.lerpVectors(

          from[i].p,

          target.position,

          e

        );


        o.quaternion.slerpQuaternions(

          from[i].q,

          target.quaternion,

          e

        );

      }
    );


    if (t < 1) {

      requestAnimationFrame(
        animateMove
      );

    }

  }


  requestAnimationFrame(
    animateMove
  );


  camera.position.set(

    0,

    0,

    layout === 'grid'

      ? 3000

      : layout === 'table'

        ? 2300

        : 2200

  );


  controls.target.set(
    0,
    0,
    0
  );


  controls.update();
}


// ==========================================
// 11. RENDER RECORDS
// ==========================================

function renderRecords(
  nextRecords,
  sourceLabel
) {

  if (
    !nextRecords.length
  ) {

    throw new Error(
      'No profile records were found.'
    );

  }


  root.clear();


  objects = [];

  records =
    nextRecords;


  records.forEach(
    (person, index) => {

      const object =
        new CSS3DObject(
          makeTile(
            person,
            index
          )
        );


      object.position.set(

        (Math.random() - 0.5) *
          5000,

        (Math.random() - 0.5) *
          3500,

        (Math.random() - 0.5) *
          4000

      );


      root.add(object);

      objects.push(object);

    }
  );


  makeTargets();


  transform(
    activeLayout
  );


  document
    .querySelector(
      '#record-count'
    )
    .textContent =
      `${records.length} records loaded`;


  document
    .querySelector(
      '#stat-total'
    )
    .textContent =
      records.length.toLocaleString();


  document
    .querySelector(
      '#stat-average'
    )
    .textContent =
      fmtMoney(

        records.reduce(
          (s, p) =>
            s + p.netWorth,
          0
        ) /
        records.length

      );


  document
    .querySelector(
      '#stat-top'
    )
    .textContent =
      fmtMoney(

        Math.max(
          ...records.map(
            p => p.netWorth
          )
        )

      );


  document
    .querySelector(
      '#source-label'
    )
    .textContent =
      sourceLabel;


  loading.classList.add(
    'hidden'
  );
}


// ==========================================
// 12. LOCAL CSV
// ==========================================

async function loadLocalCsv() {

  const res =
    await fetch(
      '/data.csv'
    );


  if (!res.ok) {

    throw new Error(
      'Could not load public/data.csv'
    );

  }


  const text =
    await res.text();


  renderRecords(

    parseCsv(text)

      .map(normalize)

      .filter(
        person =>
          person.name
      ),

    'Local CSV · sign in to sync'

  );
}


// ==========================================
// 13. GOOGLE SHEETS
// ==========================================

async function loadGoogleSheet(
  token
) {

  if (!SPREADSHEET_ID) {

    throw new Error(
      'Missing VITE_GOOGLE_SPREADSHEET_ID'
    );

  }


  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(
      SPREADSHEET_ID
    )}/values/` +
    `${encodeURIComponent(
      SHEET_RANGE
    )}`;


  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(

      data.error?.message ||

      `Google Sheets API error (${response.status})`

    );

  }


  const values =
    data.values || [];


  if (
    values.length < 2
  ) {

    throw new Error(
      'The Google Sheet is empty or contains only headers.'
    );

  }


  const headers =
    values[0].map(
      v => String(v).trim()
    );


  const rows =
    values.slice(1).map(
      row =>
        Object.fromEntries(

          headers.map(
            (h, i) => [
              h,
              row[i] ?? ''
            ]
          )

        )
    );


  renderRecords(

    rows

      .map(normalize)

      .filter(
        person =>
          person.name
      ),

    'Google Sheets · live'

  );


  showToast(
    `Successfully loaded ${records.length} records from Google Sheets.`
  );
}


// ==========================================
// 14. GOOGLE AUTHENTICATION
// ==========================================

function initializeGoogleAuth() {

  if (!GOOGLE_CLIENT_ID) {

    showToast(
      'Google Client ID is missing.'
    );

    return;
  }


  if (
    !window.google?.accounts?.oauth2
  ) {

    showToast(
      'Google Identity Services has not loaded.'
    );

    return;
  }


  tokenClient =
    window.google.accounts.oauth2
      .initTokenClient({

        client_id:
          GOOGLE_CLIENT_ID,

        scope:
          `openid email profile ${SHEETS_SCOPE}`,

        callback:
          async response => {

            if (response.error) {

              showToast(
                `Google sign-in failed: ${response.error}`
              );

              return;
            }


            accessToken =
              response.access_token;


            signInButton.disabled =
              true;


            signInButton.textContent =
              'Loading sheet…';


            loading.textContent =
              'Loading Google Sheet data…';


            loading.classList.remove(
              'hidden'
            );


            try {

              await loadGoogleSheet(
                accessToken
              );


              signInButton.textContent =
                'Google connected';

            }

            catch (error) {

              console.error(
                error
              );


              loading.classList.add(
                'hidden'
              );


              showToast(

                `Could not load Google Sheet: ${error.message}`

              );


              signInButton.textContent =
                'Retry Google sign-in';

            }

            finally {

              signInButton.disabled =
                false;

            }

          },


        error_callback:
          error => {

            showToast(

              `Google authorization error: ${error.message || error.type}`

            );

          }

      });


  tokenClient.requestAccessToken({

    prompt:
      'consent'

  });
}


// ==========================================
// 15. TOAST NOTIFICATIONS
// ==========================================

function showToast(
  message
) {

  const toast =
    document.querySelector(
      '#toast'
    );


  toast.textContent =
    message;


  toast.style.display =
    'block';


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
    setTimeout(
      () => {

        toast.style.display =
          'none';

      },
      4200
    );
}


// ==========================================
// 16. EVENT LISTENERS
// ==========================================

signInButton.addEventListener(
  'click',
  initializeGoogleAuth
);


// ------------------------------------------
// Layout buttons
// ------------------------------------------

document
  .querySelectorAll(
    '.layout'
  )
  .forEach(button => {

    button.addEventListener(
      'click',
      event => {

        event.stopPropagation();


        // Don't allow layout changes while
        // profile popup is open.
        if (
          detailPanel.classList.contains(
            'open'
          )
        ) {
          return;
        }


        if (objects.length) {

          transform(
            button.dataset.layout
          );

        }

      }
    );

  });


// ==========================================
// 17. RESIZE
// ==========================================

function onResize() {

  const w =
    container.clientWidth;


  const h =
    container.clientHeight;


  camera.aspect =
    w / h;


  camera.updateProjectionMatrix();


  renderer.setSize(
    w,
    h
  );


  controls.handleResize();
}


window.addEventListener(
  'resize',
  onResize
);


// ==========================================
// 18. RENDER LOOP
// ==========================================

function render() {

  requestAnimationFrame(
    render
  );


  // TrackballControls only updates when
  // enabled.
  controls.update();


  renderer.render(
    scene,
    camera
  );
}


render();


// ==========================================
// 19. START APPLICATION
// ==========================================

loadLocalCsv()
  .catch(error => {

    loading.textContent =
      `Unable to load local data: ${error.message}`;


    console.error(
      error
    );

  });