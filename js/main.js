// --- SETUP ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const toolbar = document.getElementById('toolbar');
const canvasContainer = document.getElementById('canvas-container');
const wireColorPicker = document.getElementById('wire-color-picker');
const wireThicknessPicker = document.getElementById('wire-thickness-picker');

const contactorEditModal = document.getElementById('contactor-edit-modal');
const addAuxContactBtn = document.getElementById('add-aux-contact');
const removeAuxContactBtn = document.getElementById('remove-aux-contact');
const closeContactorEditModalBtn = document.getElementById('close-contactor-edit-modal');
const contactorNameInput = document.getElementById('contactor-name-input');

const poleModal = document.getElementById('pole-modal');
const poleModalTitle = document.getElementById('pole-modal-title');
const poleOptionsContainer = document.getElementById('pole-options');
const closePoleModalBtn = document.getElementById('close-pole-modal');

const switchModal = document.getElementById('switch-modal');
const closeSwitchModalBtn = document.getElementById('close-switch-modal');

const relayModal = document.getElementById('relay-modal');
const relayOptionsContainer = document.getElementById('relay-options');
const closeRelayModalBtn = document.getElementById('close-relay-modal');

const thRyModal = document.getElementById('th-ry-modal');
const closeThRyModalBtn = document.getElementById('close-th-ry-modal');

const motorModal = document.getElementById('motor-modal');
const closeMotorModalBtn = document.getElementById('close-motor-modal');

const terminalBlockModal = document.getElementById('terminal-block-modal');
const tbPoleOptions = document.getElementById('tb-pole-options');
const tbOrientationOptions = document.getElementById('tb-orientation-options');
const applyTbChangesBtn = document.getElementById('save-tb-modal');

const infoBox = document.getElementById('info-box');
const infoBoxTitle = document.getElementById('info-box-title');
const infoBoxContent = document.getElementById('info-box-content');
const infoBoxClose = document.getElementById('info-box-close');

const imageViewerModal = document.getElementById('image-viewer-modal');
const enlargedImg = document.getElementById('enlarged-img');
const imageViewerClose = document.getElementById('image-viewer-close');

const saveButton = document.getElementById('save-button');
const loadButton = document.getElementById('load-button');
const fileInput = document.getElementById('file-input');

const GRID_SIZE = 20;
let components = [];
let wires = [];
let nextId = 0;

// --- State Management ---
let activeToolType = null;
let draggedToolType = null;
let draggedGhost = null;
let placementPreview = null;
let isDraggingPreview = false;
let wiringState = { start: null, end: null };
let wiringPathPoints = [];
let selectedComponent = null;
let selectedComponentForEdit = null;
let draggedComponent = null;
let isPressingButton = false;
let dragOffset = { x: 0, y: 0 };
let longPressTimer = null;
let isLongPressDrag = false;
let potentialDragComponent = null;
let longPressStartPos = { x: 0, y: 0 };
let justDragged = false;

let view = { scale: 1.0, tx: 0, ty: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let pinchState = { active: false, initialDist: 0 };

let lastTap = 0;
let lastTapPos = null;

let renameInput = null;
let componentBeingRenamed = null;

let interactingComponent = null; // For components like relays with knobs
let infoBoxTarget = null; // Component targeted by the info box
let componentDescriptionMap = new Map(); // Store for component descriptions

// --- Wire Settings ---
let defaultWireColor = '#f6e05e';
let defaultWireThickness = 3;
const WIRE_DEFAULT_COLORS = ['#f6e05e', '#e53e3e', '#4299e1', '#48bb78', '#1a202c'];
let wireColorIndex = 0;

let selectedWire = null;
let wireEditorUI = { colorRect: null, thickRect: null, deleteRect: null };
const WIRE_COLORS = {
    '#f6e05e': '#e53e3e', '#e53e3e': '#4299e1', '#4299e1': '#48bb78',
    '#48bb78': '#1a202c', '#1a202c': '#f6e05e',
};
const WIRE_THICKNESS = { 3: 6, 6: 3 };

let nextBulbColorIndex = 0;
const bulbColors = [
    { color: '#f6e05e', label: 'YL' }, { color: '#e53e3e', label: 'RL' }, { color: '#4299e1', label: 'BL' },
    { color: '#48bb78', label: 'GL' }, { color: '#ed8936', label: 'OL' },
];

// --- UTILITY & HELPER FUNCTIONS ---
const snapToGrid = (val) => Math.round(val / (GRID_SIZE / 2)) * (GRID_SIZE / 2);
const getCanvasMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - view.tx) / view.scale;
    const worldY = (screenY - view.ty) / view.scale;
    return { x: worldX, y: worldY };
};
const generateId = () => nextId++;

function pDistance(x, y, x1, y1, x2, y2) {
    const A = x - x1; const B = y - y1; const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D; const len_sq = C * C + D * D;
    let param = -1; if (len_sq != 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.sqrt(Math.pow(x - xx, 2) + Math.pow(y - yy, 2));
}

function checkCollision(rect1, ignoreId = -1) {
    for (const component of components) {
        if (component.id === ignoreId) continue;
        const rect2 = { x: component.x, y: component.y, width: component.width, height: component.height };
        if (rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y) {
            return true;
        }
    }
    return false;
}

function createTempComponent(type, x, y){
    switch (type) {
        case 'nfb': return new NFB(x, y);
        case 'bulb': return new Bulb(x, y, nextBulbColorIndex);
        case 'switch': return new Switch(x, y);
        case 'contactor': return new MagneticContactor(x, y);
        case 'fuse': return new FuseHolder(x, y);
        case 'th-ry': return new ThermalOverloadRelay(x,y);
        case 'motor': return new Motor(x,y);
        case 'terminalBlock': return new TerminalBlock(x,y);
        case 'relay': return new Relay(x, y);
        default: return null;
    }
}

// --- CANVAS RESIZING & DRAWING ---
function resizeCanvas() {
    canvas.width = canvasContainer.clientWidth;
    canvas.height = canvasContainer.clientHeight;
    draw();
}

function drawConnector(ctx, c) {
    const radius = 6;
    const fillColor = c.potential !== 0 ? (c.potential === 1 ? '#f6e05e' : '#4299e1') : '#2d3748';
    const strokeColor = c.potential !== 0 ? (c.potential === 1 ? '#f6e05e' : '#4299e1') : '#a0aec0';

    ctx.lineWidth = 1.5 / view.scale;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(c.x - radius, c.y);
    ctx.lineTo(c.x + radius, c.y);
    ctx.moveTo(c.x, c.y - radius);
    ctx.lineTo(c.x, c.y + radius);
    ctx.stroke();
}

function drawGrid() {
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 0.5 / view.scale;
    const left = -view.tx / view.scale;
    const top = -view.ty / view.scale;
    const right = (canvas.width - view.tx) / view.scale;
    const bottom = (canvas.height - view.ty) / view.scale;
    const firstX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    const firstY = Math.floor(top / GRID_SIZE) * GRID_SIZE;

    for (let x = firstX; x <= right; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }
    for (let y = firstY; y <= bottom; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
}

function drawWireEditor(ctx) {
    if (!selectedWire) {
        wireEditorUI = { colorRect: null, thickRect: null, deleteRect: null };
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedWire.path.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
    
    const uiX = centerX + 15; const uiY = centerY - 10;
    const swatchSize = 20; const buttonWidth = 30; const buttonHeight = 20; const padding = 5;

    ctx.fillStyle = selectedWire.color;
    ctx.fillRect(uiX, uiY, swatchSize, swatchSize);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 1 / view.scale;
    ctx.strokeRect(uiX, uiY, swatchSize, swatchSize);
    wireEditorUI.colorRect = { x: uiX, y: uiY, width: swatchSize, height: swatchSize };

    const thickButtonX = uiX + swatchSize + padding;
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(thickButtonX, uiY, buttonWidth, buttonHeight);
    ctx.strokeStyle = 'white'; ctx.strokeRect(thickButtonX, uiY, buttonWidth, buttonHeight);
    ctx.fillStyle = 'white'; ctx.font = `${12 / view.scale}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const thickText = selectedWire.thickness === 3 ? '細' : '粗';
    ctx.fillText(thickText, thickButtonX + buttonWidth / 2, uiY + buttonHeight / 2);
    wireEditorUI.thickRect = { x: thickButtonX, y: uiY, width: buttonWidth, height: buttonHeight };

    const deleteButtonX = thickButtonX + buttonWidth + padding;
    ctx.fillStyle = '#e53e3e';
    ctx.fillRect(deleteButtonX, uiY, buttonWidth, buttonHeight);
    ctx.strokeStyle = 'white'; ctx.strokeRect(deleteButtonX, uiY, buttonWidth, buttonHeight);
    ctx.fillStyle = 'white';
    ctx.fillText('刪', deleteButtonX + buttonWidth / 2, uiY + buttonHeight / 2);
    wireEditorUI.deleteRect = { x: deleteButtonX, y: uiY, width: buttonWidth, height: buttonHeight };
}

function getPreviewPath() {
    const path = [...wiringPathPoints];
    if (!wiringState.end) return path;
    const lastPoint = path[path.length - 1];
    const mousePoint = wiringState.end;
    
    const elbowPoint = { x: snapToGrid(mousePoint.x), y: lastPoint.y };
    const finalPoint = { x: snapToGrid(mousePoint.x), y: snapToGrid(mousePoint.y) };
    
    if(lastPoint.x !== elbowPoint.x) path.push(elbowPoint);
    if(elbowPoint.y !== finalPoint.y) path.push(finalPoint);

    return path;
}

function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(view.tx, view.ty);
    ctx.scale(view.scale, view.scale);

    drawGrid();
    
    wires.forEach(w => w.draw(ctx));

    if(selectedWire){
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = selectedWire.thickness + 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if(selectedWire.path.length > 0) {
             ctx.moveTo(selectedWire.path[0].x, selectedWire.path[0].y);
             for (let i = 1; i < selectedWire.path.length; i++) { ctx.lineTo(selectedWire.path[i].x, selectedWire.path[i].y); }
        }
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    if (selectedComponent) {
        ctx.strokeStyle = '#a0aec0';
        ctx.lineWidth = 2 / view.scale;
        ctx.setLineDash([6 / view.scale, 3 / view.scale]);
        ctx.strokeRect(selectedComponent.x - 4, selectedComponent.y - 4, selectedComponent.width + 8, selectedComponent.height + 8);
        ctx.setLineDash([]);
    }

    if (infoBoxTarget) {
        ctx.strokeStyle = '#38bdf8'; // light blue
        ctx.lineWidth = 3 / view.scale;
        ctx.setLineDash([8 / view.scale, 4 / view.scale]);
        ctx.strokeRect(infoBoxTarget.x - 6, infoBoxTarget.y - 6, infoBoxTarget.width + 12, infoBoxTarget.height + 12);
        ctx.setLineDash([]);

        // Update info box position continuously
        const screenX = (infoBoxTarget.x + infoBoxTarget.width) * view.scale + view.tx + 10;
        const screenY = infoBoxTarget.y * view.scale + view.ty;
        infoBox.style.left = `${screenX}px`;
        infoBox.style.top = `${screenY}px`;
    }

    components.forEach(c => c.draw(ctx));

    const previewComponent = placementPreview || draggedGhost;
    if (previewComponent) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        const tempComp = createTempComponent(previewComponent.type, previewComponent.x, previewComponent.y);
        if (tempComp) {
            if(tempComp.type === 'terminalBlock' || tempComp.type === 'relay') tempComp.setRelayType('2C');
            if (previewComponent.isColliding) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2 / view.scale;
                ctx.strokeRect(tempComp.x, tempComp.y, tempComp.width, tempComp.height);
            }
            tempComp.draw(ctx);
        }
        ctx.restore();
    }
    
    if (draggedComponent) {
        ctx.strokeStyle = '#e53e3e';
        ctx.lineWidth = 2 / view.scale;
        ctx.setLineDash([6 / view.scale, 3 / view.scale]);
        ctx.strokeRect(draggedComponent.x - 2, draggedComponent.y - 2, draggedComponent.width + 4, draggedComponent.height + 4);
        ctx.setLineDash([]);
    }

    if (activeToolType === 'wire' && wiringState.start && wiringState.end) {
        const previewPath = getPreviewPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = defaultWireThickness;
        ctx.beginPath();
        if(previewPath.length > 0) {
            ctx.moveTo(previewPath[0].x, previewPath[0].y);
            for(let i=1; i < previewPath.length; i++) {
                if (previewPath[i]) ctx.lineTo(previewPath[i].x, previewPath[i].y);
            }
        }
        ctx.stroke();
    }

    drawWireEditor(ctx);
    ctx.restore();
}

// --- SIMULATION LOGIC ---
function runSimulation() {
    // Reset potentials
    components.forEach(c => c.connectors.forEach(conn => conn.potential = 0));
    wires.forEach(w => w.potential = 0);

    const powerSources = components.filter(c => c.type === 'nfb');
    if (powerSources.length === 0) return;

    // Propagate positive and negative potentials
    [1, -1].forEach(potential => {
        let queue = [];
        // Start from power sources
        powerSources.forEach(nfb => {
            const startConnectors = nfb.connectors.filter(c => 
                (potential === 1 && c.type === 'positive') || (potential === -1 && c.type === 'neutral')
            );
            startConnectors.forEach(c => {
                if (c.potential === 0) {
                    c.potential = potential;
                    queue.push(c);
                }
            });
        });

        let visitedConnectors = new Set(queue.map(c => c.id));

        while (queue.length > 0) {
            const currentConn = queue.shift();
            
            // 1. Propagate through wires
            wires.forEach(w => {
                let otherConn = null;
                if (w.start.id === currentConn.id) otherConn = w.end;
                if (w.end.id === currentConn.id) otherConn = w.start;
                
                if (otherConn && !visitedConnectors.has(otherConn.id)) {
                    w.potential = potential;
                    otherConn.potential = potential;
                    visitedConnectors.add(otherConn.id);
                    queue.push(otherConn);
                }
            });
            
            // 2. Propagate through internal component connections
            const comp = currentConn.parent;
            const internalConnections = comp.getInternalConnections ? comp.getInternalConnections() : [];
            
            internalConnections.forEach(([connA, connB]) => {
                if(!connA || !connB) return;

                const connAPotential = connA.potential;
                const connBPotential = connB.potential;

                // Propagate potential if one side has it and the other doesn't
                if (connAPotential === potential && connBPotential === 0) {
                    connB.potential = potential;
                    if (!visitedConnectors.has(connB.id)) {
                        visitedConnectors.add(connB.id);
                        queue.push(connB);
                    }
                } else if (connBPotential === potential && connAPotential === 0) {
                    connA.potential = potential;
                    if (!visitedConnectors.has(connA.id)) {
                        visitedConnectors.add(connA.id);
                        queue.push(connA);
                    }
                }
            });
        }
    });

    // Check for blown fuses after all potentials are set
    components.filter(c => c.type === 'fuse' && !c.isBlown).forEach(fuse => {
        const potA = fuse.connectors[0].potential;
        const potB = fuse.connectors[1].potential;
        if ((potA === 1 && potB === -1) || (potA === -1 && potB === 1)) {
            fuse.isBlown = true;
        }
    });
}


// --- EVENT HANDLERS ---
function hideInfoBox() {
    infoBoxTarget = null;
    infoBox.classList.add('hidden');
    draw();
}

function showInfoBox(component) {
    infoBoxTarget = component;
    const key = component.getDescriptionKey();
    let descriptionText = componentDescriptionMap.get(key) || '此元件暫無說明，待補充';
    const title = component.name || component.displayName || component.type;
    
    infoBoxTitle.textContent = title;
    infoBoxContent.innerHTML = ''; // Clear previous content

    // Replace user's line break symbol with actual HTML line breaks
    descriptionText = descriptionText.replace(/;/g, '<br>');

    const urlRegex = /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif))/gi;
    const parts = descriptionText.split(urlRegex);

    parts.forEach(part => {
        if (!part) return;
        if (part.match(urlRegex)) {
            // This is a URL
            const img = document.createElement('img');
            img.src = part;
            img.className = 'info-thumbnail';
            img.title = '點擊放大圖片';
            img.onerror = () => { img.style.display = 'none'; }; // Hide if image fails to load
            img.onclick = (e) => {
                e.stopPropagation();
                enlargedImg.src = img.src;
                imageViewerModal.classList.remove('hidden');
            };
            infoBoxContent.appendChild(img);
        } else {
            // This is text, potentially with <br>
            const textContainer = document.createElement('span');
            textContainer.innerHTML = part; // Use innerHTML to render <br> tags
            infoBoxContent.appendChild(textContainer);
        }
    });


    infoBox.classList.remove('hidden');
    draw(); // To show highlight and update position
}

function closeAllModals() {
    hideInfoBox();
    contactorEditModal.classList.add('hidden');
    poleModal.classList.add('hidden');
    switchModal.classList.add('hidden');
    thRyModal.classList.add('hidden');
    motorModal.classList.add('hidden');
    terminalBlockModal.classList.add('hidden');
    relayModal.classList.add('hidden');
    if (selectedComponentForEdit) {
        selectedComponentForEdit = null;
    }
}

function handleToolClick(toolElement) {
    closeAllModals();
    if (renameInput) exitRenameMode();

    placementPreview = null;
    wiringState = { start: null, end: null };
    wiringPathPoints = [];
    selectedComponent = null;
    const clickedToolType = toolElement.dataset.type;

    if (toolElement.classList.contains('active')) {
        toolElement.classList.remove('active');
        activeToolType = null;
        canvas.style.cursor = 'default';
    } else {
        document.querySelectorAll('#toolbar .tool-item.active').forEach(el => el.classList.remove('active'));
        toolElement.classList.add('active');
        activeToolType = clickedToolType;

        canvas.style.cursor = 'default';
        if (activeToolType === 'move') canvas.style.cursor = 'grab';
        if (activeToolType === 'wire') canvas.style.cursor = 'crosshair';
        if (activeToolType === 'delete') canvas.style.cursor = 'not-allowed';
        if (activeToolType === 'query') canvas.style.cursor = 'help';
        if (activeToolType === 'rename') {
            canvas.style.cursor = 'text';
            if (selectedComponent) {
                enterRenameMode(selectedComponent);
            }
       }
    }
    draw();
}

function addComponentToCanvas(newComp) {
    switch (newComp.type) {
        case 'contactor':
        case 'motor':
        case 'terminalBlock':
        case 'th-ry':
            newComp.name = { 'contactor': 'MC', 'motor': 'M', 'terminalBlock': 'TB', 'th-ry': 'TH' }[newComp.type] + getNextNumberForType(newComp.type);
            break;
        case 'switch':
            newComp.name = 'PB' + getNextNumberForType('pushbutton');
            break;
        case 'bulb':
            newComp.displayName = 'PL' + getNextNumberForType('bulb');
            break;
        case 'relay':
            { // Use a block to scope variables
                let num, name;
                if (['2C', '3C', '4C'].includes(newComp.relayType)) {
                    num = getNextNumberForType('relay_pr');
                    name = `PR${num}`;
                } else if (newComp.relayType === 'ON-delay') {
                    num = getNextNumberForType('relay_tr');
                    name = `TR${num}`;
                } else if (newComp.relayType.startsWith('Y-delta')) {
                    num = getNextNumberForType('relay_tr_delta');
                    name = `TR${num}-Δ`;
                }
                newComp.name = name;
            }
            break;
    }

    // Apply description based on component type key
    applyDescriptionToComponent(newComp);

    components.push(newComp);
}


function handleCanvasInteraction(x, y, e = null) {
    if (renameInput) {
        if (e && e.target !== renameInput) { exitRenameMode(); }
        return;
    }
    
    if (selectedWire && wireEditorUI.colorRect) {
        const cr = wireEditorUI.colorRect; const tr = wireEditorUI.thickRect; const dr = wireEditorUI.deleteRect;
        if (x >= cr.x && x <= cr.x + cr.width && y >= cr.y && y <= cr.y + cr.height) { selectedWire.color = WIRE_COLORS[selectedWire.color] || '#f6e05e'; draw(); return; }
        if (x >= tr.x && x <= tr.x + tr.width && y >= tr.y && y <= tr.y + tr.height) { selectedWire.thickness = WIRE_THICKNESS[selectedWire.thickness] || 3; draw(); return; }
        if (x >= dr.x && x <= dr.x + dr.width && y >= dr.y && y <= dr.y + dr.height) { wires = wires.filter(w => w.id !== selectedWire.id); selectedWire = null; draw(); return; }
    }

    const isComponentTool = ['nfb', 'bulb', 'switch', 'contactor', 'fuse', 'th-ry', 'motor', 'terminalBlock', 'relay'].includes(activeToolType);
    if (isComponentTool) {
        selectedComponent = null;
        const clickedOnComponent = components.some(c => c.isUnderMouse(x, y));
        const sX = snapToGrid(x); const sY = snapToGrid(y);

        if (placementPreview) {
            const tempPreviewComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
            if(tempPreviewComp.type === 'terminalBlock') tempPreviewComp.setVariant('6P', 'vertical');
            if(tempPreviewComp.type === 'relay') tempPreviewComp.setRelayType('2C');

            const mouseOnPreview = (x >= tempPreviewComp.x && x <= tempPreviewComp.x + tempPreviewComp.width && y >= tempPreviewComp.y && y <= tempPreviewComp.y + tempPreviewComp.height);
            
            if (mouseOnPreview) {
                const rect = { x: placementPreview.x, y: placementPreview.y, width: tempPreviewComp.width, height: tempPreviewComp.height };
                if (!checkCollision(rect)) {
                    const newComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
                    if (newComp) addComponentToCanvas(newComp);
                }
                placementPreview = null;
            } else {
                placementPreview = null;
            }
        } else if (!clickedOnComponent) {
            const tempComp = createTempComponent(activeToolType, sX, sY);
            if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
            if(tempComp.type === 'relay') tempComp.setRelayType('2C');
            placementPreview = { type: activeToolType, x: tempComp.x, y: tempComp.y };
        }
    } else {
        const clickedComponent = components.find(c => c.isUnderMouse(x, y));
        const clickedConnector = components.flatMap(c => c.connectors).find(c => Math.hypot(c.x - x, c.y - y) < GRID_SIZE / 2);

        if (activeToolType === null && clickedConnector) {
            const isConnected = wires.some(w => w.start.id === clickedConnector.id || w.end.id === clickedConnector.id);
            if (!isConnected) {
                handleToolClick(document.getElementById('wire-tool'));
                wiringState.start = clickedConnector;
                wiringPathPoints.push({ x: clickedConnector.x, y: clickedConnector.y });
                draw();
                return; 
            }
        }
        
        if (activeToolType === 'query') {
            if (clickedComponent) {
                showInfoBox(clickedComponent);
            } else {
                hideInfoBox();
            }
        } else if (activeToolType === 'rename') {
            if(clickedComponent) {
                selectedComponent = clickedComponent;
                enterRenameMode(clickedComponent);
            }
        } else if (activeToolType === 'delete') {
            if (clickedComponent) {
                wires = wires.filter(w => w.start.parent.id !== clickedComponent.id && w.end.parent.id !== clickedComponent.id);
                components = components.filter(c => c.id !== clickedComponent.id);
            } else {
                const wireToDelete = wires.find(w => { if (!w.path || w.path.length < 2) return false; for (let i = 0; i < w.path.length - 1; i++) { if (pDistance(x, y, w.path[i].x, w.path[i].y, w.path[i+1].x, w.path[i+1].y) < 5) return true; } return false; });
                if (wireToDelete) wires = wires.filter(w => w.id !== wireToDelete.id);
            }
            selectedWire = null;
            selectedComponent = null;
        } else if (activeToolType === 'wire') {
            selectedComponent = null;
            if (clickedConnector) {
                if (!wiringState.start) {
                    wiringState.start = clickedConnector; wiringPathPoints.push({ x: clickedConnector.x, y: clickedConnector.y });
                } else if (wiringState.start.id !== clickedConnector.id) {
                    wiringState.end = { x: clickedConnector.x, y: clickedConnector.y };
                    wires.push(new Wire(wiringState.start, clickedConnector, getPreviewPath()));
                    wiringState = { start: null, end: null }; wiringPathPoints = [];
                }
            } else if (wiringState.start) {
                wiringState.end = { x, y };
                wiringPathPoints = getPreviewPath();
                wiringState.end = null;
            }
            selectedWire = null;
        } else {
            let somethingWasClicked = false;
            const wireToSelect = wires.find(w => { if (!w.path || w.path.length < 2) return false; for (let i = 0; i < w.path.length - 1; i++) { if (pDistance(x, y, w.path[i].x, w.path[i].y, w.path[i+1].x, w.path[i+1].y) < 6) return true; } return false; });

            if (wireToSelect) { 
                selectedWire = wireToSelect; 
                selectedComponent = null;
                somethingWasClicked = true; 
            } else if (clickedComponent) {
                selectedComponent = clickedComponent;
                selectedWire = null;
                if (clickedComponent.type === 'switch' && clickedComponent.switchType.startsWith('pushbutton')) return;
                
                if (typeof clickedComponent.handleInteraction === 'function') {
                    if (clickedComponent.type !== 'relay') {
                        clickedComponent.handleInteraction(x, y, 'click');
                    }
                }

                somethingWasClicked = true;
            }
            
            if (!somethingWasClicked) { 
                selectedWire = null; 
                selectedComponent = null;
            }
        }
    }
    draw();
}


canvas.addEventListener('mousemove', (e) => {
    const pos = getCanvasMousePos(e);
    if (interactingComponent && typeof interactingComponent.handleInteraction === 'function') {
        if (interactingComponent.handleInteraction(pos.x, pos.y, 'mousemove', pos)) {
            draw();
            return;
        }
    }

    if (isPanning) {
        canvas.style.cursor = 'grabbing';
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        view.tx += dx;
        view.ty += dy;
        panStart = { x: e.clientX, y: e.clientY };
        draw();
        return;
    }

    if (longPressTimer) {
        const dist = Math.hypot(pos.x - longPressStartPos.x, pos.y - longPressStartPos.y);
        if (dist > 5) { clearTimeout(longPressTimer); longPressTimer = null; }
    }

    if (isDraggingPreview && placementPreview) {
        placementPreview.x = snapToGrid(pos.x - dragOffset.x);
        placementPreview.y = snapToGrid(pos.y - dragOffset.y);
        justDragged = true;
    } else if ((activeToolType === 'move' || isLongPressDrag) && draggedComponent) { 
        const newX = snapToGrid(pos.x - dragOffset.x); 
        const newY = snapToGrid(pos.y - dragOffset.y); 
        draggedComponent.updatePosition(newX, newY);
        justDragged = true;
    } else if (activeToolType === 'wire' && wiringState.start) { 
        wiringState.end = pos; 
    } else if (draggedGhost) {
        draggedGhost.x = pos.x - dragOffset.x;
        draggedGhost.y = pos.y - dragOffset.y;
        const sX = snapToGrid(draggedGhost.x);
        const sY = snapToGrid(draggedGhost.y);
        const tempComp = createTempComponent(draggedGhost.type, sX, sY);
        if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
        if(tempComp.type === 'relay') tempComp.setRelayType('2C');

        draggedGhost.isColliding = checkCollision({ x: sX, y: sY, width: tempComp.width, height: tempComp.height });
    }
    draw();
});

canvas.addEventListener('click', (e) => {
    if (justDragged) return;
    const { x, y } = getCanvasMousePos(e);
    handleCanvasInteraction(x,y, e);
});

canvas.addEventListener('dblclick', (e) => {
    if (renameInput) return;
    const { x, y } = getCanvasMousePos(e); 
    handleCanvasDoubleClick(x,y);
});

function handleCanvasDoubleClick(x,y) {
    // If a double-click happens while starting a wire, cancel the wire.
    if (activeToolType === 'wire' && wiringState.start) {
        wiringState = { start: null, end: null };
        wiringPathPoints = [];
        handleToolClick(document.getElementById('wire-tool')); // This deactivates the tool
    }
    closeAllModals(); // Close any open modal first
    const clickedComponent = components.find(c => c.isUnderMouse(x, y));
    if (clickedComponent) {
        selectedComponentForEdit = clickedComponent;
        if (clickedComponent.type === 'nfb') { poleModalTitle.textContent = `編輯 NFB 極性`; openPoleModal(['1P', '2P', '3P', '4P']); }
        else if (clickedComponent.type === 'switch') { switchModal.classList.remove('hidden'); }
        else if (clickedComponent.type === 'relay') { openRelayModal(); }
        else if (clickedComponent.type === 'bulb') { clickedComponent.cycleColor(); draw(); }
        else if (clickedComponent.type === 'th-ry') { thRyModal.classList.remove('hidden'); }
        else if (clickedComponent.type === 'motor') { motorModal.classList.remove('hidden'); }
        else if (clickedComponent.type === 'terminalBlock') { openTerminalBlockModal(); }
        else if (clickedComponent.type === 'fuse' && clickedComponent.isBlown) {
            clickedComponent.isBlown = false;
        }
        else if (clickedComponent.type === 'contactor') {
            contactorNameInput.value = clickedComponent.name;
            if (clickedComponent.hasLeftAux) {
                addAuxContactBtn.style.display = 'none';
                removeAuxContactBtn.style.display = 'block';
            } else {
                addAuxContactBtn.style.display = 'block';
                removeAuxContactBtn.style.display = 'none';
            }
            contactorEditModal.classList.remove('hidden');
        }
    }
}

function openPoleModal(options) {
    poleOptionsContainer.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.dataset.poles = opt;
        btn.className = 'pole-btn flex-1 bg-blue-600 hover:bg-blue-700 p-2 rounded';
        btn.textContent = opt;
        poleOptionsContainer.appendChild(btn);
    });
    poleModal.classList.remove('hidden');
}

canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasMousePos(e);
    
    const compUnderMouse = components.find(c => c.isUnderMouse(pos.x, pos.y));
    if (compUnderMouse && typeof compUnderMouse.handleInteraction === 'function') {
        if (compUnderMouse.handleInteraction(pos.x, pos.y, 'mousedown', pos)) {
            interactingComponent = compUnderMouse;
            draw();
            return;
        }
    }

    if (e.button === 1) {
        if (renameInput) exitRenameMode();
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }
    
    justDragged = false;
    
    if (renameInput && e.target !== renameInput) {
        exitRenameMode();
    }
    
    const comp = components.find(c => c.isUnderMouse(pos.x, pos.y));
    const tempPreviewComp = placementPreview ? createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y) : null;
    if(tempPreviewComp) {
        if(tempPreviewComp.type === 'terminalBlock') tempPreviewComp.setVariant('6P', 'vertical');
        if(tempPreviewComp.type === 'relay') tempPreviewComp.setRelayType('2C');
    }
    const mouseOnPreview = tempPreviewComp && (pos.x >= tempPreviewComp.x && pos.x <= tempPreviewComp.x + tempPreviewComp.width && pos.y >= tempPreviewComp.y && pos.y <= tempPreviewComp.y + tempPreviewComp.height);
    const isComponentTool = ['nfb', 'bulb', 'switch', 'contactor', 'fuse', 'th-ry', 'motor', 'terminalBlock', 'relay'].includes(activeToolType);

    if (activeToolType === 'move' && comp) {
         canvas.style.cursor = 'grabbing';
         draggedComponent = comp;
         draggedComponent.originalX = comp.x; draggedComponent.originalY = comp.y;
         dragOffset = { x: pos.x - draggedComponent.x, y: pos.y - draggedComponent.y };
    } else if (activeToolType === null || isComponentTool) {
         if (mouseOnPreview) {
            longPressTimer = setTimeout(() => {
                isDraggingPreview = true;
                dragOffset = { x: pos.x - placementPreview.x, y: pos.y - placementPreview.y };
                longPressTimer = null;
            }, 500);
        } else if (comp) {
            potentialDragComponent = comp;
            longPressStartPos = pos;
            longPressTimer = setTimeout(() => {
                isLongPressDrag = true;
                draggedComponent = potentialDragComponent;
                draggedComponent.originalX = comp.x; draggedComponent.originalY = comp.y;
                dragOffset = { x: longPressStartPos.x - draggedComponent.x, y: longPressStartPos.y - draggedComponent.y };
                selectedWire = null;
                selectedComponent = null;
                canvas.style.cursor = 'grabbing';
                draw();
                longPressTimer = null;
            }, 500);

            if (comp.type === 'switch' && comp.switchType.startsWith('pushbutton')) {
                isPressingButton = true; comp.press(); draw();
            }
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    const pos = getCanvasMousePos(e);
    if (interactingComponent && typeof interactingComponent.handleInteraction === 'function') {
        if(interactingComponent.handleInteraction(pos.x, pos.y, 'mouseup', pos)) {
            interactingComponent = null;
            draw();
            return;
        }
    }

    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'default';
    }
    clearTimeout(longPressTimer); longPressTimer = null;
    
    if (isDraggingPreview){
        const tempComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
        if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
        if(tempComp.type === 'relay') tempComp.setRelayType('2C');
        const rect = { x: placementPreview.x, y: placementPreview.y, width: tempComp.width, height: tempComp.height };
        if(checkCollision(rect)){
           placementPreview = null;
        }
    }
    isDraggingPreview = false;

    if (activeToolType === 'move' || isLongPressDrag) canvas.style.cursor = (activeToolType === 'move' ? 'grab' : 'default');

    if (draggedComponent) {
        const rect = { x: draggedComponent.x, y: draggedComponent.y, width: draggedComponent.width, height: draggedComponent.height };
        if (checkCollision(rect, draggedComponent.id)) {
            draggedComponent.updatePosition(draggedComponent.originalX, draggedComponent.originalY);
        }
    }

    if (isLongPressDrag) isLongPressDrag = false;
    draggedComponent = null;

    if (isPressingButton) {
        isPressingButton = false;
        components.forEach(c => c.release && c.release());
    }
    
    draw();
    setTimeout(() => { justDragged = false; }, 10);
});

wireColorPicker.addEventListener('click', () => {
    wireColorIndex = (wireColorIndex + 1) % WIRE_DEFAULT_COLORS.length;
    defaultWireColor = WIRE_DEFAULT_COLORS[wireColorIndex];
    wireColorPicker.style.backgroundColor = defaultWireColor;
});

wireThicknessPicker.addEventListener('click', () => {
    defaultWireThickness = defaultWireThickness === 3 ? 6 : 3;
    wireThicknessPicker.textContent = defaultWireThickness === 3 ? '細' : '粗';
});

toolbar.addEventListener('dragstart', (e) => {
    const toolItem = e.target.closest('.tool-item');
    if(toolItem && toolItem.draggable){
         draggedToolType = toolItem.dataset.type;
         const tempComp = createTempComponent(draggedToolType, 0, 0);
         if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
         if(tempComp.type === 'relay') tempComp.setRelayType('2C');
         dragOffset.x = tempComp.width / 2;
         dragOffset.y = tempComp.height / 2;
    }
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if(!draggedToolType) return;
    const pos = getCanvasMousePos(e);
    const sX = snapToGrid(pos.x - dragOffset.x);
    const sY = snapToGrid(pos.y - dragOffset.y);
    const tempComp = createTempComponent(draggedToolType, sX, sY);
    if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
    if(tempComp.type === 'relay') tempComp.setRelayType('2C');

    draggedGhost = {
        type: draggedToolType,
        x: sX, y: sY,
        width: tempComp.width, height: tempComp.height,
        isColliding: checkCollision({ x: sX, y: sY, width: tempComp.width, height: tempComp.height })
    };
    draw();
});

canvas.addEventListener('dragleave', (e) => { draggedGhost = null; draw(); });
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    if(draggedGhost && !draggedGhost.isColliding) {
        const newComp = createTempComponent(draggedGhost.type, draggedGhost.x, draggedGhost.y);
        if(newComp) addComponentToCanvas(newComp);
        if (activeToolType === 'delete') {
            handleToolClick(document.getElementById('delete-tool'));
        }
    }
    draggedToolType = null;
    draggedGhost = null;
    draw();
});

window.addEventListener('keydown', (e) => { 
    if (selectedComponent && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); // 防止頁面滾動
        const step = GRID_SIZE / 2;
        let newX = selectedComponent.x;
        let newY = selectedComponent.y;

        switch (e.key) {
            case 'ArrowUp':    newY -= step; break;
            case 'ArrowDown':  newY += step; break;
            case 'ArrowLeft':  newX -= step; break;
            case 'ArrowRight': newX += step; break;
        }

        const rect = { x: newX, y: newY, width: selectedComponent.width, height: selectedComponent.height };
        if (!checkCollision(rect, selectedComponent.id)) {
            selectedComponent.updatePosition(newX, newY);
        }

        draw();
        return;
    }
    
    if (e.key === 'Escape' && !renameInput) { 
        if (placementPreview) { placementPreview = null; } 
        else if(activeToolType === 'wire' && wiringState.start) { wiringState = { start: null, end: null }; wiringPathPoints = []; } 
        else if (selectedWire) { selectedWire = null; } 
        else if (selectedComponent) { selectedComponent = null; }
        else if (activeToolType) { 
            document.querySelector(`.tool-item[data-type="${activeToolType}"]`)?.classList.remove('active'); 
            activeToolType = null; 
            canvas.style.cursor = 'default'; 
        } 
        draw(); 
    } else if (activeToolType === 'wire' && e.key === 'Backspace' && wiringPathPoints.length > 1) { 
        wiringPathPoints.pop(); 
        draw(); 
    } else if (e.key === 'Delete' && selectedComponent) {
        wires = wires.filter(w => w.start.parent.id !== selectedComponent.id && w.end.parent.id !== selectedComponent.id);
        components = components.filter(c => c.id !== selectedComponent.id);
        selectedComponent = null;
        draw();
    } else if (e.key === 'Delete' && selectedWire) {
        wires = wires.filter(w => w.id !== selectedWire.id);
        selectedWire = null;
        draw();
    }
});

// --- RENAME LOGIC ---
function exitRenameMode() {
    if (!renameInput || !componentBeingRenamed) return;

    const newName = renameInput.value.trim();
    if (componentBeingRenamed.type === 'bulb') {
        const newColor = bulbColors.find(c => c.label.toLowerCase() === newName.toLowerCase());
        if (newColor) {
            componentBeingRenamed.setName(newName);
        } else {
            componentBeingRenamed.displayName = newName;
        }
    }
    else if (typeof componentBeingRenamed.setName === 'function') {
         componentBeingRenamed.setName(newName);
    } else {
         componentBeingRenamed.name = newName;
    }

    // After renaming, update its description (based on type, not new name)
    applyDescriptionToComponent(componentBeingRenamed);


    renameInput.remove();
    renameInput = null;
    componentBeingRenamed = null;
    draw();
}

function enterRenameMode(component) {
    if (renameInput) exitRenameMode();
    if (typeof component.getNamePosition === 'function') {
        const pos = component.getNamePosition();
        if (!pos) return;
        
        const screenX = pos.x * view.scale + view.tx;
        const screenY = pos.y * view.scale + view.ty;
        const screenWidth = pos.width * view.scale;
        const screenHeight = pos.height * view.scale;
        const fontSize = (pos.fontSize || GRID_SIZE * 0.9) * view.scale;

        renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = pos.value;
        renameInput.className = 'rename-input';
        renameInput.style.left = `${screenX}px`;
        renameInput.style.top = `${screenY}px`;
        renameInput.style.width = `${screenWidth}px`;
        renameInput.style.height = `${screenHeight}px`;
        renameInput.style.fontSize = `${fontSize}px`;
        
        componentBeingRenamed = component;

        renameInput.addEventListener('blur', exitRenameMode);
        renameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                renameInput.blur();
            } else if (e.key === 'Escape') {
                renameInput.value = componentBeingRenamed.name || '';
                renameInput.blur();
            }
        });

        canvasContainer.appendChild(renameInput);
        renameInput.focus();
        renameInput.select();
    } else if (component.type === 'relay') { // Custom rename for relays
        const newName = prompt("請輸入繼電器的新名稱:", component.name);
        if (newName !== null) {
            component.name = newName.trim();
            draw();
        }
    }
}

// --- MODAL LOGIC ---
function applyDescriptionToComponent(component) {
    if (!component) return;
    const key = component.getDescriptionKey();
    if (componentDescriptionMap.has(key)) {
        component.description = componentDescriptionMap.get(key);
    } else {
        delete component.description;
    }
}

closeContactorEditModalBtn.addEventListener('click', () => {
    if (selectedComponentForEdit && selectedComponentForEdit.type === 'contactor') {
        selectedComponentForEdit.name = contactorNameInput.value;
    }
    contactorEditModal.classList.add('hidden');
    selectedComponentForEdit = null;
    draw();
});

poleOptionsContainer.addEventListener('click', (e) => { 
    if (e.target.classList.contains('pole-btn')) { 
        const poles = e.target.dataset.poles; 
        if (selectedComponentForEdit) { 
            selectedComponentForEdit.setPoles(poles); 
            applyDescriptionToComponent(selectedComponentForEdit);
            draw(); 
        } 
        poleModal.classList.add('hidden'); 
        selectedComponentForEdit = null; 
    } 
});
closePoleModalBtn.addEventListener('click', () => { poleModal.classList.add('hidden'); selectedComponentForEdit = null; });

switchModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('switch-type-btn')) {
        const type = e.target.dataset.switchType;
        if (selectedComponentForEdit && selectedComponentForEdit.type === 'switch') {
            const wasPushButton = selectedComponentForEdit.switchType.startsWith('pushbutton');
            const wasRotary = selectedComponentForEdit.switchType.startsWith('rotary');
            
            selectedComponentForEdit.setSwitchType(type);
            applyDescriptionToComponent(selectedComponentForEdit);
            
            const isPushButton = selectedComponentForEdit.switchType.startsWith('pushbutton');
            const isRotary = selectedComponentForEdit.switchType.startsWith('rotary');

            if (isRotary && !wasRotary) {
                selectedComponentForEdit.name = 'COS' + getNextNumberForType('rotary_switch');
            } else if (isPushButton && !wasPushButton) {
                selectedComponentForEdit.name = 'PB' + getNextNumberForType('pushbutton');
            }
            draw();
        }
        switchModal.classList.add('hidden');
        selectedComponentForEdit = null;
    }
});
closeSwitchModalBtn.addEventListener('click', () => { switchModal.classList.add('hidden'); selectedComponentForEdit = null; });

thRyModal.addEventListener('click', (e) => { 
    if (e.target.classList.contains('th-ry-type-btn')) { 
        const type = e.target.dataset.thRyType; 
        if (selectedComponentForEdit && selectedComponentForEdit.type === 'th-ry') { 
            selectedComponentForEdit.setRelayType(type); 
            applyDescriptionToComponent(selectedComponentForEdit);
            draw(); 
        } 
        thRyModal.classList.add('hidden'); 
        selectedComponentForEdit = null; 
    } 
});
closeThRyModalBtn.addEventListener('click', () => { thRyModal.classList.add('hidden'); selectedComponentForEdit = null; });

motorModal.addEventListener('click', (e) => { 
    if (e.target.classList.contains('motor-type-btn')) { 
        const type = e.target.dataset.motorType; 
        if (selectedComponentForEdit && selectedComponentForEdit.type === 'motor') { 
            selectedComponentForEdit.setMotorType(type); 
            applyDescriptionToComponent(selectedComponentForEdit);
            draw(); 
        } 
        motorModal.classList.add('hidden'); 
        selectedComponentForEdit = null; 
    } 
});
closeMotorModalBtn.addEventListener('click', () => { motorModal.classList.add('hidden'); selectedComponentForEdit = null; });

// Relay Modal
function openRelayModal() {
    relayOptionsContainer.innerHTML = '';
    for (const type in RELAY_DATA) {
        const btn = document.createElement('button');
        btn.dataset.relayType = type;
        btn.className = 'relay-type-btn bg-blue-600 hover:bg-blue-700 p-3 rounded text-sm';
        btn.textContent = RELAY_DATA[type].name;
        relayOptionsContainer.appendChild(btn);
    }
    relayModal.classList.remove('hidden');
}
relayOptionsContainer.addEventListener('click', e => {
    if(e.target.classList.contains('relay-type-btn')) {
        const type = e.target.dataset.relayType;
        if (selectedComponentForEdit && selectedComponentForEdit.type === 'relay') {
            selectedComponentForEdit.setRelayType(type);
            applyDescriptionToComponent(selectedComponentForEdit);
        }
        relayModal.classList.add('hidden');
        selectedComponentForEdit = null;
        draw();
    }
});
closeRelayModalBtn.addEventListener('click', () => {
    relayModal.classList.add('hidden');
    selectedComponentForEdit = null;
});


// Terminal Block Modal Logic
let tempTbSettings = {};

function updateTbModalButtons() {
    document.querySelectorAll('#tb-pole-options .tb-option-btn').forEach(btn => {
        const isSelected = btn.dataset.poles === tempTbSettings.poles;
        btn.classList.toggle('bg-yellow-500', isSelected);
        btn.classList.toggle('text-gray-900', isSelected);
        btn.classList.toggle('bg-blue-600', !isSelected);
        btn.classList.toggle('text-white', !isSelected);
    });
    document.querySelectorAll('#tb-orientation-options .tb-option-btn').forEach(btn => {
        const isSelected = btn.dataset.orientation === tempTbSettings.orientation;
        btn.classList.toggle('bg-yellow-500', isSelected);
        btn.classList.toggle('text-gray-900', isSelected);
        btn.classList.toggle('bg-green-600', !isSelected);
        btn.classList.toggle('text-white', !isSelected);
    });
}

function openTerminalBlockModal() {
    if (!selectedComponentForEdit || selectedComponentForEdit.type !== 'terminalBlock') return;
    tempTbSettings.poles = selectedComponentForEdit.poleType;
    tempTbSettings.orientation = selectedComponentForEdit.orientation;
    updateTbModalButtons();
    terminalBlockModal.classList.remove('hidden');
}

tbPoleOptions.addEventListener('click', e => {
    const button = e.target.closest('.tb-option-btn');
    if (button) {
        tempTbSettings.poles = button.dataset.poles;
        updateTbModalButtons();
        if (selectedComponentForEdit) {
            selectedComponentForEdit.setVariant(tempTbSettings.poles, tempTbSettings.orientation);
            draw();
        }
    }
});

tbOrientationOptions.addEventListener('click', e => {
    const button = e.target.closest('.tb-option-btn');
    if (button) {
        tempTbSettings.orientation = button.dataset.orientation;
        updateTbModalButtons();
        if (selectedComponentForEdit) {
            selectedComponentForEdit.setVariant(tempTbSettings.poles, tempTbSettings.orientation);
            draw();
        }
    }
});

applyTbChangesBtn.addEventListener('click', () => {
    terminalBlockModal.classList.add('hidden');
    selectedComponentForEdit = null;
});


// --- SAVE/LOAD/CSV LOGIC ---
function parseDataFromArray(dataArray) {
    const descriptionMap = new Map();
    dataArray.forEach(row => {
        const trimmedRow = row.trim();
        if (trimmedRow) {
            const separatorIndex = trimmedRow.indexOf(',');
            if (separatorIndex > 0) {
                const componentName = trimmedRow.substring(0, separatorIndex).trim();
                const description = trimmedRow.substring(separatorIndex + 1).trim();
                if (componentName) {
                    descriptionMap.set(componentName, description);
                }
            }
        }
    });
    return descriptionMap;
}

function applyDescriptions(descriptionMap) {
    components.forEach(comp => {
        applyDescriptionToComponent(comp);
    });
    // If an info box is currently open, refresh its content
    if (infoBoxTarget) {
        showInfoBox(infoBoxTarget);
    }
}

function loadInitialDescriptions() {
    try {
        if (typeof componentDetailsData !== 'undefined') {
            componentDescriptionMap = parseDataFromArray(componentDetailsData);
        } else {
            console.warn('找不到 componentDetailsData 資料。元件說明將無法使用。');
        }
    } catch (error) {
        console.error("載入或解析內嵌元件說明時發生錯誤:", error);
    }
}


function getNextNumberForType(type) {
    let prefix = '';
    let filterFn = (c) => c.type === type;

    switch(type) {
        case 'contactor': prefix = 'MC'; break;
        case 'motor': prefix = 'M'; break;
        case 'terminalBlock': prefix = 'TB'; break;
        case 'th-ry': prefix = 'TH'; break;
        case 'bulb': prefix = 'PL'; break;
        case 'rotary_switch':
            prefix = 'COS';
            filterFn = c => c.type === 'switch' && c.switchType.startsWith('rotary');
            break;
        case 'pushbutton':
             prefix = 'PB';
             filterFn = c => c.type === 'switch' && c.switchType.startsWith('pushbutton');
             break;
        case 'relay_pr':
            prefix = 'PR';
            filterFn = c => c.type === 'relay' && ['2C', '3C', '4C'].includes(c.relayType);
            break;
        case 'relay_tr':
            prefix = 'TR';
            filterFn = c => c.type === 'relay' && c.relayType === 'ON-delay';
            break;
        case 'relay_tr_delta':
            prefix = 'TR';
            filterFn = c => c.type === 'relay' && c.relayType.startsWith('Y-delta');
            break;
        default: return 1;
    }

    const existing = components.filter(filterFn);
    let maxNum = 0;
    
    existing.forEach(comp => {
        const nameToTest = (type === 'bulb' && comp.displayName) ? comp.displayName : comp.name;
        if (nameToTest && nameToTest.startsWith(prefix)) {
            let numStr = '';
            if (type === 'relay_tr_delta') {
                numStr = nameToTest.substring(prefix.length).replace('-Δ', '');
            } else {
                numStr = nameToTest.substring(prefix.length);
            }
            const num = parseInt(numStr);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    return maxNum + 1;
}

function saveLayout() {
    const layout = {
        components: components.map(c => {
            const data = { id: c.id, type: c.type, x: c.x, y: c.y, name: c.name };
            if (c.displayName) data.displayName = c.displayName;
            if (c.poleType) data.poleType = c.poleType;
            if (c.switchType) data.switchType = c.switchType;
            if (c.relayType) data.relayType = c.relayType;
            if (c.motorType) data.motorType = c.motorType;
            if (c.orientation) data.orientation = c.orientation;
            if (c.colorIndex !== undefined) data.colorIndex = c.colorIndex;
            if (c.isOn !== undefined) data.isOn = c.isOn;
            if (c.isBlown !== undefined) data.isBlown = c.isBlown;
            if (c.isTripped !== undefined) data.isTripped = c.isTripped;
            if (c.position) data.position = c.position;
            if (c.hasLeftAux !== undefined) data.hasLeftAux = c.hasLeftAux;
            if (c.knobs) data.knobs = c.knobs;
            // No need to save description, it will be re-applied on load
            return data;
        }),
        wires: wires.map(w => ({
            id: w.id, startConnectorId: w.start.id, endConnectorId: w.end.id,
            path: w.path, color: w.color, thickness: w.thickness
        })),
        nextId: nextId,
    };

    const dataStr = JSON.stringify(layout, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'circuit-layout.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

function loadLayout(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            reconstructLayout(JSON.parse(e.target.result));
        } catch (error) {
            console.error("Error parsing layout file:", error);
            alert("讀取檔案失敗，請確認檔案格式是否正確。");
        }
    };
    reader.readAsText(file);
    fileInput.value = '';
}

function reconstructLayout(layout) {
    components = []; wires = []; nextId = 0;

    layout.components.forEach(data => {
        let comp = createTempComponent(data.type, data.x, data.y);
        if (comp) {
            Object.assign(comp, data);
            if(comp.type === 'bulb' && data.name && data.colorIndex !== undefined){
                 comp.setName(data.name); 
                 if (data.displayName) comp.displayName = data.displayName;
            } else if (comp.type === 'terminalBlock'){
                 comp._updateFromVariant(data.poleType, data.orientation);
            } else if (comp.type === 'relay') {
                 comp.setRelayType(data.relayType); // This also rebuilds connectors
                 if (data.knobs) comp.knobs = data.knobs;
            } else {
                comp._updateDimensions();
                comp._rebuildConnectors();
            }
            components.push(comp);
        }
    });
    
    const allConnectors = new Map();
    components.forEach(c => c.connectors.forEach(conn => allConnectors.set(conn.id, conn)));

    layout.wires.forEach(data => {
        const start = allConnectors.get(data.startConnectorId);
        const end = allConnectors.get(data.endConnectorId);
        if (start && end) {
            const wire = new Wire(start, end, data.path);
            Object.assign(wire, data);
            wires.push(wire);
        }
    });

    nextId = layout.nextId || 0;
    
    // Apply descriptions to the newly loaded components
    applyDescriptions(componentDescriptionMap);

    draw();
}


// --- INITIALIZATION ---
window.addEventListener('resize', resizeCanvas);
document.querySelectorAll('#toolbar .tool-item[data-type]').forEach(el => {
   el.addEventListener('click', (e) => handleToolClick(e.currentTarget));
});

document.getElementById('bulb-tool-item').addEventListener('dblclick', () => {
    nextBulbColorIndex = (nextBulbColorIndex + 1) % bulbColors.length;
    const color = bulbColors[nextBulbColorIndex].color;
    document.getElementById('bulb-tool-item').style.boxShadow = `0 0 10px 3px ${color}`;
    setTimeout(() => { document.getElementById('bulb-tool-item').style.boxShadow = ''; }, 300);
});

infoBoxClose.addEventListener('click', hideInfoBox);
imageViewerClose.addEventListener('click', () => imageViewerModal.classList.add('hidden'));

canvas.addEventListener('wheel', e => {
    if (renameInput) exitRenameMode();
    e.preventDefault();
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mousePointX = (mouseX - view.tx) / view.scale;
    const mousePointY = (mouseY - view.ty) / view.scale;

    view.scale *= zoom;
    view.scale = Math.max(0.25, Math.min(4, view.scale));

    view.tx = mouseX - mousePointX * view.scale;
    view.ty = mouseY - mousePointY * view.scale;

    draw();
}, { passive: true });

canvas.addEventListener('touchstart', e => { e.preventDefault(); /* Touch events ommited for brevity */ }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); /* Touch events ommited for brevity */ }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); /* Touch events ommited for brevity */ }, { passive: false });

saveButton.addEventListener('click', saveLayout);
loadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', loadLayout);


let lastTime = 0;
function animate(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // 1. Update internal logic of components (like timers)
    components.forEach(c => {
        if (typeof c.updateLogic === 'function') {
            c.updateLogic(deltaTime);
        }
    });

    // 2. Propagate electrical potential
    runSimulation();
    
    // 3. Redraw the canvas
    draw();

    requestAnimationFrame(animate);
}

resizeCanvas();
loadInitialDescriptions(); // Load descriptions on startup
lastTime = performance.now();
requestAnimationFrame(animate);
wireColorPicker.style.backgroundColor = defaultWireColor;

