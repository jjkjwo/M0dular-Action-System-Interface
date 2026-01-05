/**
 * ==============================================================================================
 * Top Panel 10 - CS Style Surfing Game
 * ==============================================================================================
 *
 * A 3D surfing game inspired by Counter-Strike surfing mechanics, featuring
 * deliberate map design with progressive stages and authentic surf physics.
 * Uses Three.js for 3D rendering.
 *
 * @version 2.0.4 - Fixed keyboard event capture to only work when panel is active
 */

(function() {
    // Component definition object with improved organization
    const component = {
        id: 'top-panel-10',

        // DOM references
        dom: {
            content: null,
            canvas: null,
            loadingMessage: null,
            errorMessage: null,
            infoOverlay: null
        },

        // Component state with better organization
        state: {
            initialized: false,
            running: false,
            panelActive: false, // New: Track if panel is active/visible
            scene: null,
            camera: null,
            renderer: null,
            clock: null,
            player: {
                object: null,
                velocity: null,
                speed: 0,
                onGround: false,
                onSurface: false,
                surfaceNormal: null,
                canJump: false,
                jumpInProgress: false, // Flag to track jump execution
                jumpRequested: false,  // Flag to track jump requests from input
                jumpCooldownTimer: 0,  // Timer to prevent rapid jumps
                airAccelerationTimer: 0,
                wishDir: null,
                strafeDir: null,
                lastGroundTime: 0,
                surfingState: 0,
                previousVelocity: null,
                unstuckTimer: 0,
                contactCount: 0,
                prevSurfNormals: []
            },
            controls: {
                moveForward: false,
                moveBackward: false,
                moveLeft: false,
                moveRight: false,
                jump: false,
                keys: {},
                mouse: {
                    x: 0,
                    y: 0,
                    locked: false
                }
            },
            world: {
                stages: [],
                currentStage: 0,
                chunkSize: 300,
                gravity: null,
                groundFriction: 5.0,
                airDrag: 0.0001,
                respawnPoint: null
            },
            config: {
                // Player configuration
                playerHeight: 3,
                playerRadius: 1,
                playerMass: 80,
                
                // Physics configuration - tuned for authentic CS surf feel
                gravityValue: 25,
                jumpForce: 11,
                movementSpeed: 180,         // CHANGED: Significantly reduced from 250
                maxSpeed: 2200,             // CHANGED: Greatly reduced from 5000 for more controlled speeds
                airAccelerationBase: 150,   // Standard CS:GO value
                airStrafeMultiplier: 1.5,   // CHANGED: Reduced from 2.0 for better control
                
                // Surfing configuration - critical parameters for authentic feel
                surfingGravityReduction: 0.20, // RESTORED: Original gravity reduction value
                surfClingFactor: 0.8,      // RESTORED: Original surf cling factor
                maxSurfAngle: Math.PI * 0.45, // ~81 degrees - authentic surf ramp angle
                minSurfAngleForForce: Math.PI * 0.20,
                surfSlideDamping: 0.008,   // RESTORED: Original slide damping
                momentumConservation: 0.995, // RESTORED: Original momentum conservation
                
                // Control configuration
                lookSpeed: 1.5,
                bunnyhopWindow: 0.18,
                autoStrafeAssist: 0.20,
                
                // Map configuration
                startPlatformSize: 30,
                startPlatformHeight: 1,
                startPlatformDepth: 30,
                startPlatformPosition: { x: 0, y: 50, z: -30 },
                
                // Collision handling
                pushoutBuffer: 0.15,         // RESTORED: Original buffer value
                surfTransitionSmoothing: 0.3,
                collisionSpringFactor: 0.05,
                velocityThreshold: 0.01,
                velocitySmoothing: 0.12,
                maxContactsPerFrame: 6,     // RESTORED: Original contact limit
                unstuckThreshold: 1.0,
                unstuckTime: 60,
                unstuckForce: 5,
                
                // Physics fidelity
                subSteps: 3, // Original value: Important for jump timing
                anisotropicFriction: true,
                surfMomentumBoost: 0.03,
                minimumAirControlSpeed: 0.5,
                surfEdgeHandling: true,
                continuousCollisionDetection: true,
                
                // Jump configuration
                jumpResponseDelay: 0,
                jumpCooldown: 150,
                jumpDebug: true,            // Restored: Re-enabled jump debugging
                forceSleepWakeup: true,
                
                // Visual settings
                drawDistance: 2000,
                fogDensity: 0.0012,
                skyColor: 0x87CEEB,
                
                // Spawn settings
                spawnHeightOffset: 30
            },
            debug: {
                showStats: false,
                stats: null,
                showInfo: true,
                drawSurfaceNormals: false
            },
            materials: {
                surfRamps: null,
                obstacles: null,
                player: null,
                ground: null,
                startPlatform: null,
                stagePlatform: null,
                checkpoints: null
            },
            subscriptions: []
        },

        /**
         * Entry point for the component's initialization
         */
        initialize: function() {
            // Find the container element for the component
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Component container element not found. Initialization aborted.`);
                return;
            }
            console.log(`[${this.id}] Component container found.`);

            // Set up the UI structure
            this.setupUI();

            // Load necessary libraries
            try {
                if (typeof THREE === 'undefined') {
                    console.log(`[${this.id}] THREE.js not found globally. Initiating dynamic loading.`);
                    this.showLoading("Loading 3D library (THREE.js)...");
                    this.loadThreeJS(() => {
                        if (typeof THREE !== 'undefined') {
                            console.log(`[${this.id}] THREE.js loaded successfully. Initializing game.`);
                            this.initGame();
                        } else {
                            const errorMessage = "THREE.js failed to load. Cannot initialize game.";
                            this.showError(errorMessage);
                            console.error(`[${this.id}] ${errorMessage}`);
                        }
                    });
                } else {
                    console.log(`[${this.id}] THREE.js already loaded. Proceeding with initialization.`);
                    this.initGame();
                }
            } catch (error) {
                console.error(`[${this.id}] Error during initialization:`, error);
                this.showError(`Initialization failed: ${error.message}`);
            }

            // Subscribe to framework events
            const panelToggleCallback = (data) => {
                if (data.panelId === this.id) {
                    if (data.active) {
                        console.log(`[${this.id}] Panel activated.`);
                        this.onPanelOpen(); // Use new method for activation
                    } else {
                        console.log(`[${this.id}] Panel deactivated.`);
                        this.onPanelClose(); // Use new method for deactivation
                    }
                }
            };
            
            if (typeof Framework !== 'undefined' && typeof Framework.on === 'function') {
                Framework.on('panelToggle', panelToggleCallback);
                this.state.subscriptions.push({ event: 'panelToggle', callback: panelToggleCallback });
                console.log(`[${this.id}] Subscribed to Framework events.`);
            } else {
                console.warn(`[${this.id}] Framework not found. Panel visibility changes won't affect game state.`);
            }

            console.log(`[${this.id}] Component initialization process initiated.`);
        },

        /**
         * Called when panel is opened
         */
        onPanelOpen: function() {
            this.state.panelActive = true;
            this.setupControls(); // Set up controls when panel opens
            this.resume(); // Resume or start the game
            console.log(`[${this.id}] Panel opened - game activated and controls enabled.`);
        },

        /**
         * Called when panel is closed
         */
        onPanelClose: function() {
            this.state.panelActive = false;
            this.removeControlListeners(); // Remove control listeners when panel closes
            this.pause(); // Pause the game
            console.log(`[${this.id}] Panel closed - game paused and controls disabled.`);
        },

        /**
         * Sets up the UI structure for the component
         */
        setupUI: function() {
            if (!this.dom.content) {
                console.error(`[${this.id}] Cannot set up UI: Container element is null.`);
                return;
            }
            console.log(`[${this.id}] Setting up UI elements.`);

            // Clear any existing content
            this.dom.content.innerHTML = '';

            // Set container styles
            this.dom.content.style.position = 'relative';
            this.dom.content.style.overflow = 'hidden';
            this.dom.content.style.cursor = 'default';
            this.dom.content.style.width = '100%';
            this.dom.content.style.height = '100%';

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';
            this.dom.canvas = canvas;
            this.dom.content.appendChild(canvas);
            console.log(`[${this.id}] Canvas created.`);

            // Create loading message overlay
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'surf-loading-message';
            loadingMessage.style.cssText = `
                display: none;
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                padding: 15px 25px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                border-radius: 5px;
                fontWeight: bold;
                zIndex: 10;
                text-align: center;
                pointer-events: none;
            `;
            this.dom.loadingMessage = loadingMessage;
            this.dom.content.appendChild(loadingMessage);
            console.log(`[${this.id}] Loading message overlay created.`);

            // Create error message overlay
            const errorMessage = document.createElement('div');
            errorMessage.className = 'surf-error-message';
            errorMessage.style.cssText = `
                display: none;
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                padding: 15px 25px;
                background-color: rgba(255, 0, 0, 0.8);
                color: white;
                border-radius: 5px;
                fontWeight: bold;
                zIndex: 10;
                text-align: center;
                pointer-events: none;
            `;
            this.dom.errorMessage = errorMessage;
            this.dom.content.appendChild(errorMessage);
            console.log(`[${this.id}] Error message overlay created.`);

            // Create info/debug overlay
            const infoOverlay = document.createElement('div');
            infoOverlay.className = 'surf-info-overlay';
            infoOverlay.style.cssText = `
                display: ${this.state.debug.showInfo ? 'block' : 'none'};
                position: absolute;
                top: 10px; left: 10px;
                padding: 10px;
                background-color: rgba(0, 0, 0, 0.6);
                color: white;
                border-radius: 3px;
                fontFamily: monospace;
                fontSize: 12px;
                zIndex: 5;
                user-select: none;
                pointer-events: none;
            `;
            infoOverlay.innerHTML = `
                <strong>CS-Style Surf</strong><br>
                Click canvas to play<br>
                WASD - Move/Strafe<br>
                Mouse - Look/Turn<br>
                Space - Jump/Bhop<br>
                I - Toggle info<br>
                R - Reset position<br>
            `;
            this.dom.infoOverlay = infoOverlay;
            this.dom.content.appendChild(infoOverlay);
            console.log(`[${this.id}] Info overlay created.`);

            console.log(`[${this.id}] UI setup complete.`);
        },

        /**
         * Shows a loading message to the user
         */
        showLoading: function(message) {
            if (!this.dom.loadingMessage) {
                console.warn(`[${this.id}] Loading message element is null.`);
                return;
            }
            this.dom.loadingMessage.textContent = message;
            this.dom.loadingMessage.style.display = 'block';
        },

        /**
         * Hides the loading message
         */
        hideLoading: function() {
            if (!this.dom.loadingMessage) {
                console.warn(`[${this.id}] Loading message element is null.`);
                return;
            }
            this.dom.loadingMessage.style.display = 'none';
        },

        /**
         * Shows an error message to the user
         */
        showError: function(message, duration = 3000) {
            if (!this.dom.errorMessage) {
                console.warn(`[${this.id}] Error message element is null.`);
                return;
            }
            this.dom.errorMessage.textContent = message;
            this.dom.errorMessage.style.display = 'block';

            if (this._errorMessageTimeout) {
                clearTimeout(this._errorMessageTimeout);
                this._errorMessageTimeout = null;
            }

            this._errorMessageTimeout = setTimeout(() => {
                if (this.dom.errorMessage) {
                    this.dom.errorMessage.style.display = 'none';
                    this.dom.errorMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                }
                this._errorMessageTimeout = null;
            }, duration);
        },

        /**
         * Loads the THREE.js library dynamically
         */
        loadThreeJS: function(callback) {
            console.log(`[${this.id}] Loading THREE.js dynamically.`);

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

            script.onload = () => {
                console.log(`[${this.id}] THREE.js loaded from ${script.src}.`);
                this.loadAdditionalScripts(callback);
            };

            script.onerror = (error) => {
                console.error(`[${this.id}] Failed to load THREE.js:`, error);
                this.showError(`Failed to load 3D library. Check network connection.`);
                this.hideLoading();
            };

            document.head.appendChild(script);
            console.log(`[${this.id}] THREE.js script injected into document head.`);
        },

        /**
         * Loads additional libraries needed for the game
         */
        loadAdditionalScripts: function(callback) {
            console.log(`[${this.id}] Checking for additional scripts.`);
            const scriptsToLoad = [];

            if (this.state.debug.showStats && typeof Stats === 'undefined') {
                const statsScriptUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/r16/Stats.min.js';
                scriptsToLoad.push(statsScriptUrl);
                console.log(`[${this.id}] Adding Stats.js to load list.`);
            }

            if (scriptsToLoad.length === 0) {
                console.log(`[${this.id}] No additional scripts needed.`);
                callback();
                return;
            }

            this.showLoading(`Loading additional resources (${scriptsToLoad.length})...`);
            console.log(`[${this.id}] Loading ${scriptsToLoad.length} additional scripts...`);

            let loadedCount = 0;
            const totalScripts = scriptsToLoad.length;

            scriptsToLoad.forEach(src => {
                const script = document.createElement('script');
                script.src = src;

                const scriptLoadComplete = () => {
                    loadedCount++;
                    if (loadedCount === totalScripts) {
                        console.log(`[${this.id}] All additional scripts loaded.`);
                        callback();
                    }
                };

                script.onload = () => {
                    console.log(`[${this.id}] Script loaded: ${src}`);
                    scriptLoadComplete();
                };

                script.onerror = (error) => {
                    console.error(`[${this.id}] Failed to load script ${src}:`, error);
                    scriptLoadComplete();
                };

                document.head.appendChild(script);
                console.log(`[${this.id}] Script ${src} injected.`);
            });
        },

        /**
         * Initializes THREE.js vector objects needed for physics
         */
        initVectors: function() {
            console.log(`[${this.id}] Initializing vector objects.`);

            this.state.player.velocity = new THREE.Vector3(0, 0, 0);
            this.state.player.previousVelocity = new THREE.Vector3(0, 0, 0);
            this.state.player.surfaceNormal = new THREE.Vector3(0, 1, 0);
            this.state.player.wishDir = new THREE.Vector3(0, 0, 0);
            this.state.player.strafeDir = new THREE.Vector3(0, 0, 0);
            this.state.player.prevSurfNormals = [new THREE.Vector3(0, 1, 0)];
            this.state.world.gravity = new THREE.Vector3(0, -this.state.config.gravityValue, 0);
            this.state.world.respawnPoint = new THREE.Vector3(0, 10, 0);

            console.log(`[${this.id}] Vector objects initialized.`);
        },

        /**
         * Main initialization function for the game
         */
        initGame: function() {
            if (this.state.initialized) {
                console.log(`[${this.id}] Game already initialized.`);
                return;
            }
            
            if (typeof THREE === 'undefined') {
                const errorMessage = `Cannot initialize game without THREE.js.`;
                console.error(`[${this.id}] ${errorMessage}`);
                this.showError(errorMessage);
                return;
            }
            
            console.log(`[${this.id}] Starting game initialization.`);
            this.showLoading("Initializing game...");

            try {
                // Initialize vectors first
                this.initVectors();
                
                // Initialize core game components
                this.initScene();
                this.initMaterials();
                this.initPlayer();
                this.createSurfMap();
                
                // Note: setupControls moved to onPanelOpen
                // to only activate controls when panel is active
                
                this.setupDebugStats();

                // Mark initialization as complete
                this.state.initialized = true;
                
                // Note: Game loop will start when panel is opened
                // instead of starting immediately
                
                // Hide loading message
                this.hideLoading();
                
                console.log(`[${this.id}] Game initialized successfully.`);
            } catch (error) {
                console.error(`[${this.id}] Game initialization failed:`, error);
                this.state.initialized = false;
                this.state.running = false;
                this.showError(`Game initialization failed: ${error.message}`);
            }
        },

        /**
         * Initializes the THREE.js materials for the game
         */
        initMaterials: function() {
            console.log(`[${this.id}] Initializing materials.`);

            // Material for surfable ramps
            this.state.materials.surfRamps = new THREE.MeshStandardMaterial({
                color: 0x00bfff,
                roughness: 0.05,
                metalness: 0.5,
                emissive: 0x1a3f4d,
                emissiveIntensity: 0.1
            });

            // Material for obstacles
            this.state.materials.obstacles = new THREE.MeshStandardMaterial({
                color: 0xcc0000,
                roughness: 0.8,
                metalness: 0
            });

            // Material for player mesh
            this.state.materials.player = new THREE.MeshStandardMaterial({
                color: 0x00cc33,
                roughness: 0.6,
                metalness: 0.8
            });

            // Material for ground
            this.state.materials.ground = new THREE.MeshStandardMaterial({
                color: 0x555555,
                roughness: 0.9,
                metalness: 0.1,
                side: THREE.DoubleSide
            });

            // Material for start platform
            this.state.materials.startPlatform = new THREE.MeshStandardMaterial({
                color: 0x448844,
                roughness: 0.7,
                metalness: 0.2
            });

            // Material for stage platforms
            this.state.materials.stagePlatform = new THREE.MeshStandardMaterial({
                color: 0x4488dd,
                roughness: 0.6,
                metalness: 0.3
            });

            // Material for checkpoints
            this.state.materials.checkpoints = new THREE.MeshStandardMaterial({
                color: 0xffcc00,
                roughness: 0.5,
                metalness: 0.4,
                emissive: 0x663300,
                emissiveIntensity: 0.2
            });

            console.log(`[${this.id}] Materials initialized.`);
        },

        /**
         * Sets up the THREE.js scene, camera, renderer, and lighting
         */
        initScene: function() {
            if (!this.dom.canvas) {
                console.error(`[${this.id}] Cannot initialize scene without canvas.`);
                return;
            }
            console.log(`[${this.id}] Initializing 3D scene.`);

            // Create scene with sky background
            this.state.scene = new THREE.Scene();
            this.state.scene.background = new THREE.Color(this.state.config.skyColor);
            this.state.scene.fog = new THREE.FogExp2(this.state.config.skyColor, this.state.config.fogDensity);

            // Create camera with reduced FOV (70° vs previous 85°)
            this.state.camera = new THREE.PerspectiveCamera(
                70,
                this.dom.canvas.clientWidth / this.dom.canvas.clientHeight,
                0.1,
                this.state.config.drawDistance
            );
            this.state.camera.position.set(0, 10, 0);
            this.state.camera.rotation.order = 'YXZ';

            // Create renderer
            this.state.renderer = new THREE.WebGLRenderer({
                canvas: this.dom.canvas,
                antialias: true
            });
            this.state.renderer.setSize(this.dom.canvas.clientWidth, this.dom.canvas.clientHeight, false);
            this.state.renderer.setPixelRatio(window.devicePixelRatio);
            this.state.renderer.shadowMap.enabled = true;
            this.state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
            this.state.scene.add(ambientLight);

            // Add directional light (sun)
            const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
            sunLight.position.set(100, 150, -100);
            sunLight.target = new THREE.Object3D();
            sunLight.target.position.set(0, 0, 0);
            sunLight.castShadow = true;

            // Configure shadow camera
            const d = 200;
            sunLight.shadow.camera.left = -d;
            sunLight.shadow.camera.right = d;
            sunLight.shadow.camera.top = d;
            sunLight.shadow.camera.bottom = -d;
            sunLight.shadow.camera.near = 0.5;
            sunLight.shadow.camera.far = 500;
            sunLight.shadow.mapSize.width = 2048;
            sunLight.shadow.mapSize.height = 2048;

            this.state.scene.add(sunLight);
            this.state.scene.add(sunLight.target);

            // Initialize clock
            this.state.clock = new THREE.Clock();

            // Add resize handler
            this._handleResizeBound = this.handleResize.bind(this);
            window.addEventListener('resize', this._handleResizeBound);
            
            // Call resize handler once
            this.handleResize();

            console.log(`[${this.id}] 3D scene initialized.`);
        },

        /**
         * Creates the player object and attaches the camera
         */
        initPlayer: function() {
            if (!this.state.materials || !this.state.materials.player || !this.state.scene) {
                console.error(`[${this.id}] Cannot initialize player without required components.`);
                return;
            }
            console.log(`[${this.id}] Initializing player.`);

            // Create player mesh (cylinder)
            const playerGeometry = new THREE.CylinderGeometry(
                this.state.config.playerRadius,
                this.state.config.playerRadius,
                this.state.config.playerHeight,
                16
            );
            const playerMesh = new THREE.Mesh(playerGeometry, this.state.materials.player);
            playerMesh.castShadow = true;
            playerMesh.receiveShadow = true;
            playerMesh.name = 'playerMesh';

            // Create parent object for player
            this.state.player.object = new THREE.Object3D();
            this.state.player.object.name = 'playerObject';

            // Position mesh relative to parent
            playerMesh.position.y = 0;
            this.state.player.object.add(playerMesh);

            // Attach camera to player
            this.state.camera.position.set(0, this.state.config.playerHeight * 0.8, 0);
            this.state.player.object.add(this.state.camera);

            // Set initial position
            this.state.player.object.position.set(0, this.state.config.playerHeight, 0);

            // Add player to scene
            this.state.scene.add(this.state.player.object);

            console.log(`[${this.id}] Player initialized.`);
        },

        /**
         * Creates a surf map with carefully designed stages
         */
        createSurfMap: function() {
            if (!this.state.materials || !this.state.scene || !this.state.player) {
                console.error(`[${this.id}] Cannot create surf map without required components.`);
                return;
            }
            console.log(`[${this.id}] Creating surf map.`);

            // Create a parent object for the entire map
            const mapObject = new THREE.Group();
            mapObject.name = 'surf_map';
            
            // Create start platform
            this.createStartPlatform(mapObject);
            
            // Create the map stages in sequence
            this.createStage1(mapObject);
            this.createStage2(mapObject);
            this.createStage3(mapObject);
            
            // Add the map to the scene
            this.state.scene.add(mapObject);
            
            // Set player to starting position
            this.resetPlayer();
            
            console.log(`[${this.id}] Surf map created with ${this.state.world.stages.length} stages.`);
        },

        /**
         * Creates the start platform
         */
        createStartPlatform: function(parentObject) {
            // Create start platform
            const startPlatformGeometry = new THREE.BoxGeometry(
                this.state.config.startPlatformSize,
                this.state.config.startPlatformHeight,
                this.state.config.startPlatformDepth
            );
            const startPlatform = new THREE.Mesh(startPlatformGeometry, this.state.materials.startPlatform);

            // Position platform
            startPlatform.position.set(
                this.state.config.startPlatformPosition.x,
                this.state.config.startPlatformPosition.y,
                this.state.config.startPlatformPosition.z
            );
            startPlatform.receiveShadow = true;
            startPlatform.name = 'start_platform';

            // Add physics properties
            startPlatform.userData.isSurfable = true;
            startPlatform.userData.isGround = true;

            // Set respawn point - positioned higher above the platform now
            this.state.world.respawnPoint = new THREE.Vector3(
                this.state.config.startPlatformPosition.x,
                this.state.config.startPlatformPosition.y + 
                this.state.config.startPlatformHeight / 2 + 
                this.state.config.playerHeight / 2 + 
                this.state.config.spawnHeightOffset, // Added height offset
                this.state.config.startPlatformPosition.z  // Spawn in the middle of the platform now
            );

            // Add to map
            parentObject.add(startPlatform);
            
            return startPlatform;
        },

        /**
         * Creates the first stage of the surf map
         */
        createStage1: function(parentObject) {
            const stage = new THREE.Group();
            stage.name = 'stage_1';
            
            // Stage 1: Gentle introduction with a smooth starting ramp leading to a continuous curve
            
            // Create a checkpoint/respawn point for this stage
            const checkpointGeometry = new THREE.BoxGeometry(10, 1, 10);
            const checkpoint = new THREE.Mesh(checkpointGeometry, this.state.materials.checkpoints);
            checkpoint.position.set(0, 15, -60);
            checkpoint.userData.isCheckpoint = true;
            checkpoint.userData.checkpointId = 1;
            checkpoint.userData.respawnPoint = new THREE.Vector3(0, 20, -60);
            stage.add(checkpoint);
            
            // Starting ramp - gentle incline
            const startRampGeometry = new THREE.BoxGeometry(30, 2, 40);
            const startRamp = new THREE.Mesh(startRampGeometry, this.state.materials.surfRamps);
            startRamp.position.set(0, 5, -20);
            startRamp.rotation.x = -Math.PI * 0.15; // 27 degrees - gentle incline
            startRamp.userData.isSurfable = true;
            stage.add(startRamp);
            
            // First curve - right side
            const ramp1 = this.createSurfRamp(30, 2, 60, 0, 20, -70, Math.PI * 0.25, 0, Math.PI * 0.05);
            ramp1.userData.isSurfable = true;
            stage.add(ramp1);
            
            // Second ramp - left side
            const ramp2 = this.createSurfRamp(30, 2, 60, -40, 35, -120, Math.PI * 0.25, 0, -Math.PI * 0.05);
            ramp2.userData.isSurfable = true;
            stage.add(ramp2);
            
            // Connecting curve
            const connector1 = this.createSurfRamp(20, 2, 30, -20, 50, -160, Math.PI * 0.20, 0, 0);
            connector1.userData.isSurfable = true;
            stage.add(connector1);
            
            // Main ramp to stage 2
            const mainRamp = this.createSurfRamp(40, 2, 80, 20, 60, -200, Math.PI * 0.22, 0, Math.PI * 0.08);
            mainRamp.userData.isSurfable = true;
            stage.add(mainRamp);
            
            // Add stage to parent and stages array
            parentObject.add(stage);
            this.state.world.stages.push({
                object: stage,
                respawnPoint: new THREE.Vector3(0, 20, -60)
            });
            
            return stage;
        },

        /**
         * Creates the second stage of the surf map
         */
        createStage2: function(parentObject) {
            const stage = new THREE.Group();
            stage.name = 'stage_2';
            
            // Stage 2: Intermediate section with alternating ramps and a half-pipe
            
            // Create a checkpoint/respawn point for this stage
            const checkpointGeometry = new THREE.BoxGeometry(10, 1, 10);
            const checkpoint = new THREE.Mesh(checkpointGeometry, this.state.materials.checkpoints);
            checkpoint.position.set(40, 80, -280);
            checkpoint.userData.isCheckpoint = true;
            checkpoint.userData.checkpointId = 2;
            checkpoint.userData.respawnPoint = new THREE.Vector3(40, 85, -280);
            stage.add(checkpoint);
            
            // Landing platform
            const landingPad = this.createSurfRamp(30, 2, 30, 40, 75, -280, 0, 0, 0);
            landingPad.userData.isSurfable = true;
            landingPad.userData.isGround = true;
            stage.add(landingPad);
            
            // Main series of descending alternating ramps
            
            // Right curve
            const ramp1 = this.createSurfRamp(35, 2, 80, 80, 70, -330, Math.PI * 0.20, 0, Math.PI * 0.12);
            ramp1.userData.isSurfable = true;
            stage.add(ramp1);
            
            // Left curve
            const ramp2 = this.createSurfRamp(35, 2, 80, 40, 60, -390, Math.PI * 0.20, 0, -Math.PI * 0.15);
            ramp2.userData.isSurfable = true;
            stage.add(ramp2);
            
            // Right curve deeper
            const ramp3 = this.createSurfRamp(40, 2, 90, -20, 45, -440, Math.PI * 0.22, 0, Math.PI * 0.15);
            ramp3.userData.isSurfable = true;
            stage.add(ramp3);
            
            // Half-pipe section
            const halfPipeRadius = 30;
            const halfPipeLength = 100;
            const halfPipeSegments = 20;
            const openAngle = Math.PI * 0.6; // 108 degrees opening
            
            const halfPipeGeometry = new THREE.CylinderGeometry(
                halfPipeRadius, halfPipeRadius, halfPipeLength, 
                halfPipeSegments, 8, true, 0, Math.PI * 2 - openAngle
            );
            
            const halfPipe = new THREE.Mesh(halfPipeGeometry, this.state.materials.surfRamps);
            halfPipe.position.set(30, 25, -520);
            halfPipe.rotation.x = Math.PI / 2;
            halfPipe.rotation.z = Math.PI / 4; // Angled opening
            halfPipe.userData.isSurfable = true;
            
            stage.add(halfPipe);
            
            // Exit ramp to stage 3
            const exitRamp = this.createSurfRamp(40, 2, 80, 80, 5, -590, Math.PI * 0.15, 0, Math.PI * 0.05);
            exitRamp.userData.isSurfable = true;
            stage.add(exitRamp);
            
            // Add stage to parent and stages array
            parentObject.add(stage);
            this.state.world.stages.push({
                object: stage,
                respawnPoint: new THREE.Vector3(40, 85, -280)
            });
            
            return stage;
        },

        /**
         * Creates the third stage of the surf map
         */
        createStage3: function(parentObject) {
            const stage = new THREE.Group();
            stage.name = 'stage_3';
            
            // Stage 3: Advanced section with steeper ramps and more challenging transitions
            
            // Create a checkpoint/respawn point for this stage
            const checkpointGeometry = new THREE.BoxGeometry(10, 1, 10);
            const checkpoint = new THREE.Mesh(checkpointGeometry, this.state.materials.checkpoints);
            checkpoint.position.set(130, 0, -650);
            checkpoint.userData.isCheckpoint = true;
            checkpoint.userData.checkpointId = 3;
            checkpoint.userData.respawnPoint = new THREE.Vector3(130, 5, -650);
            stage.add(checkpoint);
            
            // Starting platform 
            const startPad = this.createSurfRamp(30, 2, 30, 130, 0, -650, 0, 0, 0);
            startPad.userData.isSurfable = true;
            startPad.userData.isGround = true;
            stage.add(startPad);
            
            // First steep climb 
            const climbRamp = this.createSurfRamp(30, 2, 80, 130, 20, -710, -Math.PI * 0.22, 0, 0);
            climbRamp.userData.isSurfable = true;
            stage.add(climbRamp);
            
            // Main curve - steep right curve
            const curve1 = this.createSurfRamp(50, 2, 100, 160, 50, -780, Math.PI * 0.25, 0, Math.PI * 0.20);
            curve1.userData.isSurfable = true;
            stage.add(curve1);
            
            // S-curve section
            const leftCurve = this.createSurfRamp(50, 2, 80, 120, 30, -850, Math.PI * 0.25, 0, -Math.PI * 0.15);
            leftCurve.userData.isSurfable = true;
            stage.add(leftCurve);
            
            const rightCurve = this.createSurfRamp(50, 2, 80, 60, 10, -900, Math.PI * 0.25, 0, Math.PI * 0.15);
            rightCurve.userData.isSurfable = true;
            stage.add(rightCurve);
            
            // Final big drop
            const finalDrop = this.createSurfRamp(60, 2, 120, 20, -20, -1000, Math.PI * 0.28, 0, 0);
            finalDrop.userData.isSurfable = true;
            stage.add(finalDrop);
            
            // Finish platform
            const finishGeometry = new THREE.BoxGeometry(50, 2, 50);
            const finish = new THREE.Mesh(finishGeometry, this.state.materials.stagePlatform);
            finish.position.set(20, -50, -1080);
            finish.userData.isSurfable = true;
            finish.userData.isGround = true;
            finish.userData.isFinish = true;
            stage.add(finish);
            
            // Add stage to parent and stages array
            parentObject.add(stage);
            this.state.world.stages.push({
                object: stage,
                respawnPoint: new THREE.Vector3(130, 5, -650)
            });
            
            return stage;
        },

        /**
         * Helper method to create a surf ramp with given parameters
         */
        createSurfRamp: function(width, height, length, x, y, z, rotX, rotY, rotZ) {
            const geometry = new THREE.BoxGeometry(width, height, length);
            const ramp = new THREE.Mesh(geometry, this.state.materials.surfRamps);
            ramp.position.set(x, y, z);
            ramp.rotation.set(rotX, rotY, rotZ);
            ramp.castShadow = true;
            ramp.receiveShadow = true;
            return ramp;
        },

        /**
         * Draws a debug normal line to visualize collisions
         */
        drawNormal: function(position, normal, scale = 3) {
            if (!this.state.scene || !this.state.debug.drawSurfaceNormals || !position || !normal) {
                return;
            }
            
            if (!position.isVector3 || !normal.isVector3) {
                console.warn(`[${this.id}] Invalid vectors for normal drawing.`);
                return;
            }
            
            // Remove previous debug normal
            const prevNormal = this.state.scene.getObjectByName('debug_normal');
            if (prevNormal) {
                this.state.scene.remove(prevNormal);
                if (prevNormal.geometry) prevNormal.geometry.dispose();
                if (prevNormal.material) prevNormal.material.dispose();
            }
            
            // Create new debug normal line
            const points = [];
            points.push(position.clone());
            points.push(position.clone().add(normal.clone().multiplyScalar(scale)));
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
            
            const line = new THREE.Line(geometry, material);
            line.name = 'debug_normal';
            
            this.state.scene.add(line);
        },

        /**
         * Handles collisions between player and world
         */
        handleCollisions: function(deltaTime) {
            if (!this.state.player || !this.state.player.object || !this.state.player.velocity || !this.state.config || !this.state.scene || !this.state.world) {
                console.error(`[${this.id}] handleCollisions called with incomplete state.`);
                return;
            }

            const player = this.state.player;
            const playerRadius = this.state.config.playerRadius;
            const playerHeight = this.state.config.playerHeight;
            const config = this.state.config;

            // Store previous collision state
            const wasOnGround = player.onGround;
            const wasOnSurface = player.onSurface;
            
            // Reset collision state for current frame
            player.onGround = false;
            player.onSurface = false;
            
            // Reset contact counter
            player.contactCount = 0;
            
            // Save previous surface normal for smoothing
            let previousNormal = null;
            if (wasOnSurface && player.prevSurfNormals.length > 0) {
                previousNormal = player.prevSurfNormals[0].clone();
            }
            
            // Clear previous surface normals
            player.prevSurfNormals = [];

            // Compile list of collidable objects
            const collisionObjects = [];
            
            // Get all collidable objects from the scene
            this.state.scene.traverse(obj => {
                if (obj.isMesh && (obj.userData.isSurfable || obj.userData.isObstacle || obj.userData.isGround)) {
                    if (obj !== player.object.getObjectByName('playerMesh')) {
                        if (!collisionObjects.includes(obj)) {
                            collisionObjects.push(obj);
                        }
                    }
                }
                
                // Check for checkpoints
                if (obj.isMesh && obj.userData.isCheckpoint) {
                    const playerPos = player.object.position;
                    const checkpointPos = obj.position;
                    const distance = playerPos.distanceTo(checkpointPos);
                    
                    if (distance < 10) {
                        const checkpointId = obj.userData.checkpointId;
                        
                        // Set respawn point if player touches checkpoint
                        if (obj.userData.respawnPoint) {
                            this.state.world.respawnPoint.copy(obj.userData.respawnPoint);
                            console.log(`[${this.id}] Checkpoint ${checkpointId} reached. Respawn point updated.`);
                        }
                    }
                }
                
                // Check for finish
                if (obj.isMesh && obj.userData.isFinish) {
                    const playerPos = player.object.position;
                    const finishPos = obj.position;
                    const distance = playerPos.distanceTo(finishPos);
                    
                    if (distance < 20) {
                        console.log(`[${this.id}] Finish reached!`);
                        this.showFinishMessage();
                    }
                }
            });

            // IMPROVED COLLISION DETECTION: Using more rays for better coverage

            // Detect ground contact - Using improved raycasting for better detection
            // Use multiple rays from different origins on the bottom of the player - RESTORED ORIGINAL RAY PATTERN
            let groundDetected = false;
            const groundRayOrigins = [
                new THREE.Vector3(0, 0, 0), // Center
                new THREE.Vector3(playerRadius * 0.5, 0, 0), // Right
                new THREE.Vector3(-playerRadius * 0.5, 0, 0), // Left
                new THREE.Vector3(0, 0, playerRadius * 0.5), // Front
                new THREE.Vector3(0, 0, -playerRadius * 0.5), // Back
            ];
            
            for (const offset of groundRayOrigins) {
                if (groundDetected) break; // Skip if we already found ground
                
                const rayOrigin = player.object.position.clone().add(offset);
                rayOrigin.y -= (playerHeight / 2) - playerRadius - 0.1;
                
                const downRay = new THREE.Raycaster(
                    rayOrigin,
                    new THREE.Vector3(0, -1, 0),
                    0,
                    playerRadius + 0.3 // Increased detection range
                );
                
                const groundIntersects = downRay.intersectObjects(collisionObjects, true);
                
                // Process ground hit
                if (groundIntersects.length > 0) {
                    const hit = groundIntersects[0];
                    
                    if (hit && hit.object) {
                        const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
                        
                        if (!hit.object.matrixWorld) {
                            hit.object.updateMatrixWorld(true);
                        }
                        
                        if (hit.object.matrixWorld) {
                            normal.transformDirection(hit.object.matrixWorld).normalize();
                        }

                        const angleWithUp = Math.acos(THREE.MathUtils.clamp(normal.dot(new THREE.Vector3(0, 1, 0)), -1, 1));
                        const maxGroundAngle = Math.PI / 3.5;

                        const hitObjectIsGroundable = hit.object.userData.isGround === true || hit.object.userData.isSurfable === true;

                        if (hitObjectIsGroundable && normal.y > 0.1 && angleWithUp < maxGroundAngle) {
                            // Set ground state
                            player.onGround = true;
                            groundDetected = true;

                            // Snap position to ground with slight offset to prevent "sinking" issues
                            player.object.position.y = hit.point.y + playerHeight / 2 + 0.05;

                            // Stop downward velocity
                            if (player.velocity.y < 0) {
                                player.velocity.y = 0;
                            }

                            // Enable jumping - CRITICAL FOR JUMP FUNCTIONALITY
                            player.canJump = true;
                            player.lastGroundTime = this.state.clock.elapsedTime;
                            
                            // Reset jump cooldown
                            player.jumpCooldownTimer = 0;

                            // If we were in a jump, end it
                            if (player.jumpInProgress) {
                                player.jumpInProgress = false;
                                if (config.jumpDebug) console.log(`[${this.id}] Jump ended - landed on ground`);
                            }

                            // Add normal to tracked list
                            player.prevSurfNormals.push(normal.clone());

                            // Set surface state if applicable
                            if (hit.object.userData.isSurfable) {
                                player.onSurface = true;
                                player.surfaceNormal.copy(normal);
                                
                                // Debug surface normal
                                if (config.jumpDebug) console.log(`[${this.id}] On surface: normal=${normal.x.toFixed(2)},${normal.y.toFixed(2)},${normal.z.toFixed(2)}`);
                            }
                            
                            // Log ground detection if debug enabled
                            if (config.jumpDebug && !wasOnGround) {
                                console.log(`[${this.id}] Ground detected at ${hit.point.y.toFixed(2)}, player height: ${player.object.position.y.toFixed(2)}`);
                            }
                        }
                    }
                }
            }

            // IMPROVED SURFACE DETECTION: More rays and better handling

            // Surface detection if not grounded
            if (!player.onGround) {
                // Increased ray count for better detection
                const numSurfaceRays = config.continuousCollisionDetection ? 90 : 60; // Increased from 70/50
                const surfaceRayOrigin = player.object.position.clone();
                const surfaceRayLength = playerRadius * 1.5;

                let bestSurfHit = null;
                let closestDistance = surfaceRayLength;

                // Cast rays in multiple directions
                for (let i = 0; i < numSurfaceRays; i++) {
                    const angle = (i / numSurfaceRays) * Math.PI * 2;
                    // Better distribution with improved spiral pattern
                    const pitch = Math.asin(2 * (i / numSurfaceRays) - 1);

                    const dir = new THREE.Vector3(
                        Math.cos(angle) * Math.cos(pitch),
                        Math.sin(pitch),
                        Math.sin(angle) * Math.cos(pitch)
                    ).normalize();

                    const ray = new THREE.Raycaster(surfaceRayOrigin, dir, 0, surfaceRayLength);
                    const intersects = ray.intersectObjects(collisionObjects, true);

                    if (intersects.length > 0) {
                        const hit = intersects[0];
                        const surfaceObj = hit.object;
                        
                        if (!surfaceObj || !surfaceObj.matrixWorld) {
                            if (surfaceObj) {
                                surfaceObj.updateMatrixWorld(true);
                            } else {
                                continue;
                            }
                        }
                        
                        let normal = new THREE.Vector3(0, 1, 0);
                        if (hit.face) {
                            normal = hit.face.normal.clone();
                            if (surfaceObj.matrixWorld) {
                                normal.transformDirection(surfaceObj.matrixWorld).normalize();
                            } else {
                                continue;
                            }
                        }

                        const isSurfable = surfaceObj.userData.isSurfable === true;
                        
                        if (isSurfable && hit.distance < closestDistance) {
                            bestSurfHit = { hit, normal, object: surfaceObj };
                            closestDistance = hit.distance;
                            
                            if (player.contactCount < config.maxContactsPerFrame) {
                                player.prevSurfNormals.push(normal.clone());
                                player.contactCount++;
                            }
                        }
                    }
                }

                // Process best surf hit
                if (bestSurfHit) {
                    player.onSurface = true;
                    
                    // Calculate weighted average normal
                    if (player.prevSurfNormals.length > 0) {
                        const avgNormal = new THREE.Vector3(0, 0, 0);
                        
                        player.prevSurfNormals.forEach(normal => {
                            avgNormal.add(normal);
                        });
                        
                        avgNormal.normalize();
                        
                        if (previousNormal) {
                            avgNormal.lerp(previousNormal, config.surfTransitionSmoothing);
                            avgNormal.normalize();
                        }
                        
                        player.surfaceNormal.copy(avgNormal);
                    } else {
                        player.surfaceNormal.copy(bestSurfHit.normal);
                    }

                    // Apply pushout force
                    const pushMagnitude = playerRadius - bestSurfHit.hit.distance + config.pushoutBuffer;
                    
                    if (pushMagnitude > 0.001) {
                        const totalPush = pushMagnitude * (1.0 + config.collisionSpringFactor);
                        player.object.position.add(player.surfaceNormal.clone().multiplyScalar(totalPush));
                    } else {
                        const minSeparation = config.pushoutBuffer * 0.3 * deltaTime;
                        player.object.position.add(player.surfaceNormal.clone().multiplyScalar(minSeparation));
                    }

                    // Redirect velocity along surface
                    const dot = player.velocity.dot(player.surfaceNormal);
                    
                    if (dot < -0.001) {
                        const velocityIntoNormal = player.surfaceNormal.clone().multiplyScalar(dot);
                        const velocityAlongPlane = player.velocity.clone().sub(velocityIntoNormal);
                        
                        const bounceFactor = Math.abs(dot) * config.collisionSpringFactor;
                        
                        player.velocity.copy(velocityAlongPlane);
                        player.velocity.add(player.surfaceNormal.clone().multiplyScalar(bounceFactor));
                        
                        if (wasOnSurface && previousNormal && 
                            previousNormal.angleTo(player.surfaceNormal) > 0.1) {
                            const currentSpeed = player.velocity.length();
                            if (currentSpeed > 1.0) {
                                const boostDir = player.velocity.clone().normalize();
                                const boostMagnitude = currentSpeed * config.surfMomentumBoost;
                                player.velocity.add(boostDir.multiplyScalar(boostMagnitude));
                            }
                        }
                    }

                    // Draw debug normal
                    if (this.state.debug.drawSurfaceNormals && this.state.scene) {
                        this.drawNormal(player.object.position.clone(), player.surfaceNormal, 3);
                    }
                }
            }

            // Wall/obstacle detection
            if (!player.onGround && !player.onSurface) {
                // IMPROVED WALL DETECTION: More rays at different heights

                // Increased rays for better wall detection
                const numWallRays = 48; // Increased from 36
                const wallRayLength = playerRadius * 1.6; // Slightly increased
                const wallCollisions = [];
                
                // Cast rays at two different heights for better obstacle detection
                const rayHeights = [0, playerHeight * 0.25]; // Added a second ray height

                for (const heightOffset of rayHeights) {
                    for (let i = 0; i < numWallRays; i++) {
                        const angle = (i / numWallRays) * Math.PI * 2;
                        
                        const dir = new THREE.Vector3(
                            Math.cos(angle),
                            0.05 * Math.sin(angle),
                            Math.sin(angle)
                        ).normalize();

                        const origin = player.object.position.clone();
                        origin.y += heightOffset;
                        
                        const ray = new THREE.Raycaster(origin, dir, 0, wallRayLength);
                        const intersects = ray.intersectObjects(collisionObjects, true);

                        if (intersects.length > 0) {
                            const hit = intersects[0];
                            const hitObject = hit.object;
                            
                            if (!hitObject || !hitObject.matrixWorld) {
                                if (hitObject) {
                                    hitObject.updateMatrixWorld(true);
                                } else {
                                    continue;
                                }
                            }

                            let hitNormal = new THREE.Vector3(0, 1, 0);
                            if (hit.face) {
                                hitNormal = hit.face.normal.clone();
                                
                                if (hitObject.matrixWorld) {
                                    hitNormal.transformDirection(hitObject.matrixWorld).normalize();
                                } else {
                                    continue;
                                }
                            }
                            
                            const hitNormalAngleWithUp = Math.acos(THREE.MathUtils.clamp(hitNormal.dot(new THREE.Vector3(0, 1, 0)), -1, 1));
                            const isSteepOrObstacle = hitObject.userData.isObstacle === true || 
                                                    (hitObject.userData.isSurfable === true && 
                                                    hitNormalAngleWithUp >= this.state.config.maxSurfAngle);

                            if (hit.distance < wallRayLength && isSteepOrObstacle) {
                                wallCollisions.push({
                                    distance: hit.distance,
                                    normal: hitNormal,
                                    point: hit.point,
                                    object: hitObject,
                                    objectName: hitObject.name || 'Unnamed Mesh'
                                });
                            }
                        }
                    }
                }

                // Process wall collisions
                if (wallCollisions.length > 0) {
                    // Sort by distance
                    wallCollisions.sort((a, b) => a.distance - b.distance);
                    
                    // Get closest collision
                    const closestCollision = wallCollisions[0];
                    const wallNormal = closestCollision.normal.clone();
                    const wallHitDistance = closestCollision.distance;

                    // Calculate push-out force
                    const estimatedPenetration = playerRadius - wallHitDistance + 0.05;
                    const pushMagnitude = estimatedPenetration * (1.0 + config.collisionSpringFactor);

                    // Apply position correction
                    if (pushMagnitude > 0.001) {
                        const bufferPush = config.pushoutBuffer;
                        player.object.position.add(wallNormal.clone().multiplyScalar(pushMagnitude + bufferPush));
                    } else {
                        const bufferPush = config.pushoutBuffer * 0.25 * deltaTime;
                        player.object.position.add(wallNormal.clone().multiplyScalar(bufferPush));
                    }

                    // Calculate dot product to check if velocity points into wall
                    const dot = player.velocity.dot(wallNormal);

                    // Redirect velocity if hitting wall
                    if (dot < -0.001) {
                        const velocityAlongNormal = wallNormal.clone().multiplyScalar(dot);
                        player.velocity.sub(velocityAlongNormal);
                        
                        const bounceFactor = Math.abs(dot) * config.collisionSpringFactor * 0.5;
                        player.velocity.add(wallNormal.clone().multiplyScalar(bounceFactor));
                    }

                    // Apply very gentle friction to walls
                    player.velocity.multiplyScalar(0.995);

                    // Handle steep surfable walls
                    if (closestCollision.object.userData.isSurfable === true) {
                        player.onSurface = true;
                        player.surfaceNormal.copy(wallNormal);
                    }

                    // Draw wall normal for debugging
                    if (this.state.debug.drawSurfaceNormals && this.state.scene) {
                        this.drawNormal(player.object.position.clone(), wallNormal, 3);
                    }
                }
            }

            // Update jump ability based on final ground state
            if (player.onGround) {
                player.canJump = true;
                
                // Make sure jump can reset properly after landing
                if (!wasOnGround && player.jumpInProgress) {
                    player.jumpInProgress = false;
                    if (config.jumpDebug) console.log(`[${this.id}] Jump ended on landing - canJump reset to true`);
                }
                
                // Debug jump state
                if (config.jumpDebug && !wasOnGround) {
                    console.log(`[${this.id}] Ground contact established - jump enabled`);
                }
            }

            // Handle transitions between surfaces
            const transitionedBetweenSurfaces = (wasOnSurface || wasOnGround) && player.onSurface;
            const hasValidPreviousNormal = previousNormal !== null;
            const normalHasChanged = hasValidPreviousNormal && 
                                    player.onSurface && 
                                    previousNormal.angleTo(player.surfaceNormal) > 0.05;

            if (transitionedBetweenSurfaces && normalHasChanged) {
                // Conserve momentum between surfaces
                const currentTotalSpeed = player.velocity.length();
                
                // Project velocity onto new surface
                const velocityProjectedOntoNewSurfacePlane = player.velocity.clone().projectOnPlane(player.surfaceNormal);
                
                if (velocityProjectedOntoNewSurfacePlane.lengthSq() > 0.001) {
                    velocityProjectedOntoNewSurfacePlane.normalize();
                    
                    const conservedSpeedMagnitude = currentTotalSpeed * config.momentumConservation;
                    const transitionVelocity = velocityProjectedOntoNewSurfacePlane.multiplyScalar(conservedSpeedMagnitude);
                    
                    player.velocity.lerp(transitionVelocity, 0.7);
                } else {
                    player.velocity.multiplyScalar(config.momentumConservation * 0.6);
                }
            } else if (!player.onGround && wasOnGround) {
                // Just left ground - no special handling needed
            } else if (player.onSurface && !player.onGround && !wasOnSurface && !wasOnGround) {
                // Landing on surf from air - add slight bounce
                player.canJump = false;
                player.velocity.add(player.surfaceNormal.clone().multiplyScalar(0.2));
            }

            // Prevent extremely small velocities from zeroing out
            if (player.velocity.lengthSq() < config.velocityThreshold * config.velocityThreshold) {
                player.velocity.multiplyScalar(0.99);
            }
            
            // Out of bounds check (below stage)
            if (player.object.position.y < -300) {
                this.resetPlayerToRespawn();
            }
        },

        /**
         * Shows a finish message when player completes the course
         */
        showFinishMessage: function() {
            if (!this.dom.errorMessage) {
                console.warn(`[${this.id}] Error message element is null.`);
                return;
            }
            
            // Display finish message
            this.dom.errorMessage.textContent = '🏆 Course Complete! 🏆';
            this.dom.errorMessage.style.backgroundColor = 'rgba(50, 200, 50, 0.8)';
            this.dom.errorMessage.style.display = 'block';
            
            // Set timeout to hide message
            if (this._errorMessageTimeout) {
                clearTimeout(this._errorMessageTimeout);
                this._errorMessageTimeout = null;
            }
            
            this._errorMessageTimeout = setTimeout(() => {
                if (this.dom.errorMessage) {
                    this.dom.errorMessage.style.display = 'none';
                    this.dom.errorMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                }
                this._errorMessageTimeout = null;
            }, 5000);
        },

        /**
         * Performs a single physics update step
         */
        updatePhysicsStep: function(deltaTime, player, controls, config, world, currentTime) {
            // FIXED: Process jump requests more reliably by logging the state
            if (config.jumpDebug && (controls.jump || player.jumpRequested)) {
                console.log(`[${this.id}] Jump request processing: jump=${controls.jump}, jumpRequested=${player.jumpRequested}, onGround=${player.onGround}, canJump=${player.canJump}, jumpInProgress=${player.jumpInProgress}`);
            }
            
            // Process jump request at the beginning of the physics step
            if ((controls.jump || player.jumpRequested) && !player.jumpInProgress) {
                // Reset jump request flag
                player.jumpRequested = false;
                
                // Valid jump if: on ground OR within bhop window AND canJump is true
                const horizontalSpeedSq = new THREE.Vector3(player.velocity.x, 0, player.velocity.z).lengthSq();
                const minSpeedForAirBhop = config.minimumAirControlSpeed * config.minimumAirControlSpeed;
                const isWithinBhopWindow = (currentTime - player.lastGroundTime < config.bunnyhopWindow);
                
                const canJumpNow = player.canJump && 
                    (player.onGround || 
                     (isWithinBhopWindow && horizontalSpeedSq >= minSpeedForAirBhop) ||
                     player.onSurface);
                
                // Additional safeguard: only allow jump if not already jumping and past cooldown
                if (canJumpNow && !player.jumpInProgress && player.jumpCooldownTimer <= 0) {
                    // Debug output
                    if (config.jumpDebug) {
                        console.log(`[${this.id}] Jump executed: onGround=${player.onGround}, onSurface=${player.onSurface}, speed=${Math.sqrt(horizontalSpeedSq).toFixed(2)}`);
                    }
                    
                    // Apply jump force - INCREASED for more noticeable effect
                    player.velocity.y = config.jumpForce * 1.2;
                    
                    // Set jump state
                    player.jumpInProgress = true;
                    player.canJump = false; // Disable jumping until landing
                    player.onGround = false;
                    player.onSurface = false;
                    player.surfingState = 0;
                    
                    // Start cooldown timer
                    player.jumpCooldownTimer = config.jumpCooldown;
                    
                    // Update last ground time to prevent double jumps
                    player.lastGroundTime = currentTime - config.bunnyhopWindow / 2;
                    
                    // Force player slightly upward to ensure they clear the ground
                    player.object.position.y += 0.1;
                }
            }
            
            // Update jump cooldown timer
            if (player.jumpCooldownTimer > 0) {
                player.jumpCooldownTimer -= deltaTime * 1000;
            }

            // Apply gravity
            // Scale down gravity when surfing for smoother motion
            let gravityScale = 1.0;
             
            if (player.onSurface && !player.onGround) {
                // Transition surfing state
                player.surfingState = Math.min(2, player.surfingState + 1);
                
                if (player.surfingState === 1) {
                    // Transitioning to surf - partial reduction
                    gravityScale = 0.5;
                } else if (player.surfingState === 2) {
                    // Full surf - maximum reduction
                    gravityScale = config.surfingGravityReduction;
                }
            } else {
                // Reset surfing state
                player.surfingState = 0;
            }
             
            player.velocity.y += world.gravity.y * deltaTime * gravityScale;

            // Calculate wish direction from input
            // Get camera direction
            const cameraDirection = new THREE.Vector3();
            this.state.camera.getWorldDirection(cameraDirection);

            // Project to horizontal plane
            const cameraDirectionHorizontal = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
            if (cameraDirectionHorizontal.lengthSq() < 0.001) cameraDirectionHorizontal.set(0, 0, -1);

            // Calculate right vector
            const rightVectorHorizontal = new THREE.Vector3(-cameraDirectionHorizontal.z, 0, cameraDirectionHorizontal.x).normalize();
            if (rightVectorHorizontal.lengthSq() < 0.001) rightVectorHorizontal.set(1, 0, 0);

            // Build wish direction
            player.wishDir.set(0, 0, 0);
            if (controls.moveForward) player.wishDir.add(cameraDirectionHorizontal);
            if (controls.moveBackward) player.wishDir.sub(cameraDirectionHorizontal);
            if (controls.moveRight) player.wishDir.add(rightVectorHorizontal);
            if (controls.moveLeft) player.wishDir.sub(rightVectorHorizontal);

            // Normalize wish direction
            const wishDirLengthSq = player.wishDir.lengthSq();
            if (wishDirLengthSq > 0.001) {
                player.wishDir.normalize();
            }

            // Get current horizontal velocity
            const currentVelXZ = new THREE.Vector3(player.velocity.x, 0, player.velocity.z);
            let currentSpeedXZ = currentVelXZ.length();

            // Apply movement physics
            if (player.onGround) {
                // Ground movement
                if (wishDirLengthSq > 0.001) {
                    const currentSpeedAlongWish = currentVelXZ.dot(player.wishDir);
                    const targetSpeedInWishDir = config.movementSpeed;
                    const neededSpeedIncreaseAlongWish = targetSpeedInWishDir - currentSpeedAlongWish;

                    if (neededSpeedIncreaseAlongWish > 0) {
                        const maxGroundAccelForce = config.movementSpeed * 10;
                        const accelImpulseMagnitude = Math.min(neededSpeedIncreaseAlongWish / deltaTime, maxGroundAccelForce) * deltaTime;
                        player.velocity.add(player.wishDir.clone().multiplyScalar(accelImpulseMagnitude));

                        // Update current speed
                        currentVelXZ.copy(player.velocity).setY(0);
                        currentSpeedXZ = currentVelXZ.length();
                    }
                }

                // Apply ground friction
                if (currentSpeedXZ > 0.01) {
                    const frictionLossMagnitude = currentSpeedXZ * world.groundFriction * deltaTime;
                    const newSpeedXZ = Math.max(0, currentSpeedXZ - frictionLossMagnitude);
                    
                    if (newSpeedXZ < currentSpeedXZ) {
                        if (currentSpeedXZ > 0) {
                            const scaleFactor = newSpeedXZ / currentSpeedXZ;
                            player.velocity.x *= scaleFactor;
                            player.velocity.z *= scaleFactor;
                        } else {
                            player.velocity.x = 0;
                            player.velocity.z = 0;
                        }
                    }
                } else if (currentSpeedXZ !== 0) {
                    player.velocity.x = 0;
                    player.velocity.z = 0;
                }

                player.airAccelerationTimer = 0;

            } else {
                // Air movement physics - authentic strafe jumping mechanics
                
                // Update strafe direction
                if (currentSpeedXZ > 0.001) {
                    player.strafeDir.copy(currentVelXZ).normalize();
                } else if (wishDirLengthSq > 0.001) {
                    player.strafeDir.copy(player.wishDir);
                }

                // Air acceleration logic
                let dotProduct = player.wishDir.dot(player.strafeDir);

                // Auto-strafe assist
                if (config.autoStrafeAssist > 0 && (controls.moveLeft || controls.moveRight) && 
                    currentSpeedXZ > 0.1 && wishDirLengthSq > 0.001) {
                    
                    const idealStrafeDir = new THREE.Vector3(0, 1, 0).cross(player.strafeDir).normalize();
                    
                    const targetAssistDir = controls.moveRight ? idealStrafeDir : idealStrafeDir.negate();
                    
                    if (targetAssistDir.lengthSq() > 0.001) {
                        player.wishDir.lerp(targetAssistDir, config.autoStrafeAssist);
                        player.wishDir.normalize();
                        
                        dotProduct = player.wishDir.dot(player.strafeDir);
                    }
                }

                // Calculate air acceleration using CS-style formula
                const isMovingForward = controls.moveForward && !controls.moveLeft && !controls.moveRight;
                
                let effectiveAirAccel = config.airAccelerationBase;
                if (isMovingForward) {
                    effectiveAirAccel *= 0.25;
                } 
                else if (Math.abs(dotProduct) < 0.3) {
                    effectiveAirAccel *= 1.2;
                }

                const maxAirAccelImpulseMagnitude = effectiveAirAccel * deltaTime;
                
                const accelMagnitudeScale = (1.0 - Math.abs(dotProduct)) * config.airStrafeMultiplier;
                
                const accelImpulseVector = player.wishDir.clone().multiplyScalar(maxAirAccelImpulseMagnitude * accelMagnitudeScale);
                player.velocity.add(accelImpulseVector);

                // Increment air time
                player.airAccelerationTimer += deltaTime;

                // Apply minimal air drag
                player.velocity.x *= (1.0 - world.airDrag);
                player.velocity.z *= (1.0 - world.airDrag);
                player.velocity.y *= (1.0 - world.airDrag * 0.5);
            }

            // Surf-specific physics
            if (player.onSurface && !player.onGround) {
                // Apply slide damping
                if (player.velocity.lengthSq() > 0.001) {
                    const velocityOnSurfPlane = player.velocity.clone().projectOnPlane(player.surfaceNormal);
                    const speedOnSurfPlane = velocityOnSurfPlane.length();

                    if (speedOnSurfPlane > 0.001) {
                        const surfDampingImpulse = speedOnSurfPlane * config.surfSlideDamping * deltaTime * 3;
                        
                        const dampingDirection = velocityOnSurfPlane.clone().normalize().negate();
                        
                        player.velocity.add(dampingDirection.multiplyScalar(surfDampingImpulse));
                    }
                }
            }

            // Cap maximum velocity
            const finalHorizontalSpeed = new THREE.Vector3(player.velocity.x, 0, player.velocity.z).length();
            if (finalHorizontalSpeed > config.maxSpeed) {
                const scaleFactor = config.maxSpeed / finalHorizontalSpeed;
                player.velocity.x *= scaleFactor;
                player.velocity.z *= scaleFactor;
            }

            // Unstuck detection
            if (finalHorizontalSpeed < config.unstuckThreshold && 
                (controls.moveForward || controls.moveBackward || controls.moveLeft || controls.moveRight)) {
                player.unstuckTimer++;
                
                if (player.unstuckTimer > config.unstuckTime) {
                    console.log(`[${this.id}] Applying unstuck force`);
                    player.velocity.y += config.unstuckForce;
                    player.unstuckTimer = 0;
                }
            } else {
                player.unstuckTimer = 0;
            }

            // Update player position
            player.object.position.x += player.velocity.x * deltaTime;
            player.object.position.y += player.velocity.y * deltaTime;
            player.object.position.z += player.velocity.z * deltaTime;

            // Handle collisions
            this.handleCollisions(deltaTime);

            // Update speed for display
            player.speed = new THREE.Vector3(player.velocity.x, 0, player.velocity.z).length();

            // Apply velocity smoothing
            if (config.velocitySmoothing > 0) {
                const smoothingFactor = config.velocitySmoothing;
                player.velocity.lerp(player.previousVelocity, smoothingFactor);
            }
        },

        /**
         * Main player update function - handles physics and updates state
         */
        updatePlayer: function(deltaTime) {
            if (!this.state.player || !this.state.player.object || !this.state.player.velocity || !this.state.world || !this.state.config || !this.state.controls || !this.state.clock || !this.state.materials) {
                console.error(`[${this.id}] updatePlayer called with incomplete state.`);
                if (this.state.running) {
                    this.pause();
                    this.showError("Internal error in physics. Check console.");
                }
                return;
            }

            const player = this.state.player;
            const controls = this.state.controls;
            const config = this.state.config;
            const world = this.state.world;
            const clock = this.state.clock;

            // Get current time
            const currentTime = clock.elapsedTime;

            // Store previous velocity
            player.previousVelocity.copy(player.velocity);

            // Run physics sub-steps for stability
            const subSteps = this.state.config.subSteps;
            const subDelta = deltaTime / subSteps;
            
            for (let step = 0; step < subSteps; step++) {
                this.updatePhysicsStep(subDelta, player, controls, config, world, currentTime);
            }

            // Update info display
            if (this.state.debug.showInfo && this.dom.infoOverlay) {
                this.updateInfoDisplay(currentTime);
            }
        },

        /**
         * Main game update loop
         */
        update: function() {
            if (!this.state.running) {
                return;
            }

            // Get delta time since last frame
            let deltaTime = this.state.clock ? this.state.clock.getDelta() : 0.016;

            // Clamp delta time to prevent physics issues
            const maxDeltaTime = 0.05;
            deltaTime = Math.min(deltaTime, maxDeltaTime);

            // Update player physics
            this.updatePlayer(deltaTime);

            // Render the scene
            if (this.state.renderer && this.state.scene && this.state.camera) {
                this.ensureCanvasSizing();
                this.state.renderer.render(this.state.scene, this.state.camera);
            } else {
                console.error(`[${this.id}] Rendering failed: Missing renderer, scene, or camera.`);
                this.pause();
                this.showError("Rendering system error.");
                return;
            }

            // Update stats display
            if (this.state.debug.showStats && this.state.debug.stats) {
                this.state.debug.stats.update();
            }

            // Schedule next frame
            requestAnimationFrame(() => this.update());
        },

        /**
         * Ensures canvas size matches container
         */
        ensureCanvasSizing: function() {
            if (!this.state.renderer || !this.dom.canvas) return;

            const canvas = this.dom.canvas;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            if (canvas.width !== width || canvas.height !== height) {
                this.state.renderer.setSize(width, height, false);

                if (this.state.camera) {
                    this.state.camera.aspect = width / height;
                    this.state.camera.updateProjectionMatrix();
                }

                console.log(`[${this.id}] Canvas resized to ${width}x${height}`);
            }
        },

        /**
         * Starts the game animation loop
         */
        startGameLoop: function() {
            if (this.state.running) {
                return;
            }

            console.log(`[${this.id}] Starting game loop.`);

            this.state.running = true;

            if (this.state.clock) {
                this.state.clock.start();
                console.log(`[${this.id}] Game clock started.`);
            } else {
                console.error(`[${this.id}] Clock is null. Cannot start physics simulation.`);
                this.pause();
                this.showError("Internal game clock error.");
                return;
            }

            requestAnimationFrame(() => this.update());
            console.log(`[${this.id}] Game loop active.`);
        },

        /**
         * Pauses the game
         */
        pause: function() {
            if (!this.state.running) {
                return;
            }

            this.state.running = false;
            console.log(`[${this.id}] Game paused.`);

            if (this.state.clock) {
                this.state.clock.stop();
                console.log(`[${this.id}] Game clock stopped.`);
            } else {
                console.warn(`[${this.id}] Cannot stop clock - it is null.`);
            }
        },

        /**
         * Resumes the game
         */
        resume: function() {
            if (!this.state.initialized) {
                console.log(`[${this.id}] Initializing game before resuming.`);
                this.initGame();
                return;
            }

            if (this.state.running) {
                return;
            }

            console.log(`[${this.id}] Resuming game.`);
            this.startGameLoop();
        },

        /**
         * Sets up performance monitoring with Stats.js
         */
        setupDebugStats: function() {
            if (this.state.debug.showStats && typeof Stats !== 'undefined') {
                if(this.state.debug.stats && this.state.debug.stats.dom && this.state.debug.stats.dom.parentElement){
                    this.state.debug.stats.dom.parentElement.removeChild(this.state.debug.stats.dom);
                    this.state.debug.stats = null;
                    console.log(`[${this.id}] Removed existing Stats.js panel.`);
                }

                this.state.debug.stats = new Stats();
                this.state.debug.stats.showPanel(0);

                this.state.debug.stats.dom.style.position = 'absolute';
                this.state.debug.stats.dom.style.top = '0px';
                this.state.debug.stats.dom.style.left = 'auto';
                this.state.debug.stats.dom.style.right = '0px';
                this.state.debug.stats.dom.style.zIndex = 99;

                if (this.dom.content) {
                    this.dom.content.appendChild(this.state.debug.stats.dom);
                    console.log(`[${this.id}] Stats.js panel added.`);
                } else {
                    console.warn(`[${this.id}] Cannot add Stats.js panel - container is null.`);
                }
            } else if (this.state.debug.stats) {
                if(this.state.debug.stats.dom && this.state.debug.stats.dom.parentElement){
                    this.state.debug.stats.dom.parentElement.removeChild(this.state.debug.stats.dom);
                    this.state.debug.stats = null;
                    console.log(`[${this.id}] Stats.js panel removed.`);
                }
            }
        },

        /**
         * Sets up player controls (keyboard and mouse)
         * Now only adds controls when the panel is active
         */
        setupControls: function() {
            if (!this.dom.content || !this.dom.canvas) {
                console.error(`[${this.id}] Cannot set up controls - required DOM elements missing.`);
                return;
            }
            
            // First, make sure to clean up any existing listeners to prevent duplicates
            this.removeControlListeners();
            
            console.log(`[${this.id}] Setting up controls.`);

            // Add keyboard event listeners to document but check for panel active state in handlers
            this._handleKeyDownBound = this.handleKeyDown.bind(this);
            this._handleKeyUpBound = this.handleKeyUp.bind(this);
            
            // Add event listeners to document (but we'll check if panel is active in the handlers)
            document.addEventListener('keydown', this._handleKeyDownBound);
            document.addEventListener('keyup', this._handleKeyUpBound);
            console.log(`[${this.id}] Keyboard listeners added to document (with panel active check).`);

            // Mouse event listeners
            this._handleCanvasClickBound = () => {
                if(this.state.running && !this.state.controls.mouse.locked){
                    console.log(`[${this.id}] Requesting pointer lock.`);
                    this.requestPointerLock();
                } else if (!this.state.running) {
                    console.log(`[${this.id}] Canvas clicked but game not running.`);
                }
            };
            this.dom.canvas.addEventListener('click', this._handleCanvasClickBound);
            console.log(`[${this.id}] Canvas click listener added.`);

            this._handleMouseMoveBound = this.handleMouseMove.bind(this);
            this.dom.content.addEventListener('mousemove', this._handleMouseMoveBound);
            console.log(`[${this.id}] Mouse move listener added.`);

            // Pointer lock listeners
            this._handlePointerLockChangeBound = this.handlePointerLockChange.bind(this);
            document.addEventListener('pointerlockchange', this._handlePointerLockChangeBound);
            document.addEventListener('mozpointerlockchange', this._handlePointerLockChangeBound);
            document.addEventListener('webkitpointerlockchange', this._handlePointerLockChangeBound);
            console.log(`[${this.id}] Pointer lock change listeners added.`);

            // Pointer lock error handlers
            this._handlePointerLockErrorBound = (e) => {
                console.error(`[${this.id}] Pointer lock error:`, e);
                this.showError("Pointer lock failed. Check permissions or try clicking again.");
                this.state.controls.mouse.locked = false;
                if(this.dom.content) this.dom.content.style.cursor = 'default';
                if (this.dom.infoOverlay) this.dom.infoOverlay.style.opacity = '1';
                this.resetControlState();
            };
            
            document.addEventListener('pointerlockerror', this._handlePointerLockErrorBound);
            document.addEventListener('mozpointerlockerror', this._handlePointerLockErrorBound);
            document.addEventListener('webkitpointerlockerror', this._handlePointerLockErrorBound);
            console.log(`[${this.id}] Pointer lock error listeners added.`);

            console.log(`[${this.id}] Control setup complete.`);
        },
        
        /**
         * Removes control event listeners when panel is deactivated
         */
        removeControlListeners: function() {
            console.log(`[${this.id}] Removing control listeners.`);
            
            // Remove keyboard listeners from document
            if (this._handleKeyDownBound) {
                document.removeEventListener('keydown', this._handleKeyDownBound);
                console.log(`[${this.id}] Keyboard keydown listener removed from document.`);
            }
            
            if (this._handleKeyUpBound) {
                document.removeEventListener('keyup', this._handleKeyUpBound);
                console.log(`[${this.id}] Keyboard keyup listener removed from document.`);
            }
            
            // Remove document-wide listeners
            if (this._handlePointerLockChangeBound) {
                document.removeEventListener('pointerlockchange', this._handlePointerLockChangeBound);
                document.removeEventListener('mozpointerlockchange', this._handlePointerLockChangeBound);
                document.removeEventListener('webkitpointerlockchange', this._handlePointerLockChangeBound);
                console.log(`[${this.id}] Pointer lock change listeners removed.`);
            }
            
            if (this._handlePointerLockErrorBound) {
                document.removeEventListener('pointerlockerror', this._handlePointerLockErrorBound);
                document.removeEventListener('mozpointerlockerror', this._handlePointerLockErrorBound);
                document.removeEventListener('webkitpointerlockerror', this._handlePointerLockErrorBound);
                console.log(`[${this.id}] Pointer lock error listeners removed.`);
            }
            
            // Remove other listeners
            if (this._handleCanvasClickBound && this.dom.canvas) {
                this.dom.canvas.removeEventListener('click', this._handleCanvasClickBound);
                console.log(`[${this.id}] Canvas click listener removed.`);
            }
            
            if (this._handleMouseMoveBound && this.dom.content) {
                this.dom.content.removeEventListener('mousemove', this._handleMouseMoveBound);
                console.log(`[${this.id}] Mouse move listener removed.`);
            }
            
            // Exit pointer lock if active
            if (document.pointerLockElement === this.dom.canvas) {
                document.exitPointerLock();
                console.log(`[${this.id}] Exited pointer lock.`);
            }
            
            // Reset control state
            this.resetControlState();
            
            console.log(`[${this.id}] Control listener removal complete.`);
        },
        
        /**
         * Resets all control state values
         */
        resetControlState: function() {
            if (this.state.controls) {
                this.state.controls.moveForward = false;
                this.state.controls.moveBackward = false;
                this.state.controls.moveLeft = false;
                this.state.controls.moveRight = false;
                this.state.controls.jump = false;
                this.state.controls.keys = {};
                this.state.controls.mouse.locked = false;
                console.log(`[${this.id}] Control state reset.`);
            }
        },

        /**
         * Handles window resize events
         */
        handleResize: function() {
            if (!this.state.renderer || !this.state.camera || !this.dom.canvas) {
                console.warn(`[${this.id}] Cannot handle resize - required components missing.`);
                return;
            }

            const width = this.dom.canvas.clientWidth;
            const height = this.dom.canvas.clientHeight;

            if (this.dom.canvas.width === width && this.dom.canvas.height === height) {
                return;
            }

            this.state.renderer.setSize(width, height, false);
            this.state.camera.aspect = width / height;
            this.state.camera.updateProjectionMatrix();
        },

        /**
         * Handles keyboard key down events
         * Now checks if panel is active before processing game controls
         */
        handleKeyDown: function(event) {
            // Only process key events if panel is active
            if (!this.state.panelActive) {
                // Special case for 'r' key when not active, but potentially typed in chat
                if (event.code === 'KeyR') {
                    event.stopPropagation(); // Stop event from bubbling
                }
                return;
            }
            
            // Store key state
            this.state.controls.keys[event.code] = true;

            // Set movement flags
            if (event.code === 'KeyW' || event.code === 'ArrowUp') {
                this.state.controls.moveForward = true;
            } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
                this.state.controls.moveBackward = true;
            } else if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
                this.state.controls.moveLeft = true;
            } else if (event.code === 'KeyD' || event.code === 'ArrowRight') {
                this.state.controls.moveRight = true;
            }             else if (event.code === 'Space') {
                // FIXED: Better jump handling - don't rely on jumpRequested being reset elsewhere
                // Set the control state
                this.state.controls.jump = true;
                
                // Only set jumpRequested if not already in a jump and can actually jump
                if (!this.state.player.jumpInProgress && this.state.player.canJump) {
                    this.state.player.jumpRequested = true;
                    
                    // Debug jump request
                    if (this.state.config.jumpDebug) {
                        console.log(`[${this.id}] Jump requested via Space - canJump=${this.state.player.canJump}, onGround=${this.state.player.onGround}, cooldown=${this.state.player.jumpCooldownTimer}`);
                    }
                } else if (this.state.config.jumpDebug) {
                    console.log(`[${this.id}] Jump requested but REJECTED - jumpInProgress=${this.state.player.jumpInProgress}, canJump=${this.state.player.canJump}`);
                }
            }

            // Toggle info display with I key
            if (event.code === 'KeyI') {
                this.state.debug.showInfo = !this.state.debug.showInfo;
                
                if (this.dom.infoOverlay) {
                    this.dom.infoOverlay.style.display = this.state.debug.showInfo ? 'block' : 'none';
                }
                console.log(`[${this.id}] Debug info ${this.state.debug.showInfo ? 'enabled' : 'disabled'}.`);
            }

            // Reset player with R key but only when mouse is locked (active gameplay)
            if (event.code === 'KeyR') {
                // Only prevent default if we're actually going to use this key
                if (this.state.controls.mouse.locked) {
                    event.preventDefault();
                    
                    this.resetPlayerToRespawn();
                    console.log(`[${this.id}] Player reset via R key.`);
                }
            }

            // Toggle performance stats with Ctrl+P
            if ((event.ctrlKey || event.metaKey) && event.code === 'KeyP') {
                event.preventDefault();
                
                this.state.debug.showStats = !this.state.debug.showStats;
                console.log(`[${this.id}] Performance stats ${this.state.debug.showStats ? 'enabled' : 'disabled'}.`);
                
                this.setupDebugStats();
            }

            // Toggle normal visualization with Ctrl+N
            if ((event.ctrlKey || event.metaKey) && event.code === 'KeyN') {
                event.preventDefault();
                
                this.state.debug.drawSurfaceNormals = !this.state.debug.drawSurfaceNormals;
                console.log(`[${this.id}] Surface normal visualization ${this.state.debug.drawSurfaceNormals ? 'enabled' : 'disabled'}.`);
            }
        },

        /**
         * Handles keyboard key up events
         * Now checks if panel is active before processing game controls
         */
        handleKeyUp: function(event) {
            // Only process key events if panel is active
            if (!this.state.panelActive) {
                return;
            }
            
            // Clear key state
            this.state.controls.keys[event.code] = false;

            // Clear movement flags
            if (event.code === 'KeyW' || event.code === 'ArrowUp') {
                this.state.controls.moveForward = false;
            } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
                this.state.controls.moveBackward = false;
            } else if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
                this.state.controls.moveLeft = false;
            } else if (event.code === 'KeyD' || event.code === 'ArrowRight') {
                this.state.controls.moveRight = false;
            } else if (event.code === 'Space') {
                this.state.controls.jump = false;
                // Note: jumpRequested flag is not cleared here - it's handled in physics update
                // This allows the jump to be processed in the next physics step
            }
        },

        /**
         * Handles pointer lock state changes
         */
        handlePointerLockChange: function() {
            const isLocked = document.pointerLockElement === this.dom.canvas ||
                            document.mozPointerLockElement === this.dom.canvas ||
                            document.webkitPointerLockElement === this.dom.canvas;

            this.state.controls.mouse.locked = isLocked;

            if (isLocked) {
                // Pointer locked - hide cursor, dim overlay
                if (this.dom.content) {
                    this.dom.content.style.cursor = 'none';
                }
                
                if (this.dom.infoOverlay) {
                    this.dom.infoOverlay.style.opacity = '0.3';
                }
                
                console.log(`[${this.id}] Pointer lock acquired.`);
            } else {
                // Pointer unlocked - show cursor, restore overlay
                if (this.dom.content) {
                    this.dom.content.style.cursor = 'default';
                }
                
                if (this.dom.infoOverlay) {
                    this.dom.infoOverlay.style.opacity = '1.0';
                }
                
                // Reset movement controls
                this.resetControlState();
                
                console.log(`[${this.id}] Pointer lock released.`);
            }
        },

        /**
         * Requests pointer lock on the canvas
         */
        requestPointerLock: function() {
            if (!this.dom.canvas) {
                console.error(`[${this.id}] Cannot request pointer lock - canvas is null.`);
                return;
            }

            if (!this.state.running) {
                console.warn(`[${this.id}] Not requesting pointer lock - game is not running.`);
                return;
            }

            if (this.state.controls.mouse.locked) {
                return;
            }

            console.log(`[${this.id}] Requesting pointer lock.`);

            try {
                if (this.dom.canvas.requestPointerLock) {
                    this.dom.canvas.requestPointerLock();
                }
                else if (this.dom.canvas.mozRequestPointerLock) {
                    this.dom.canvas.mozRequestPointerLock();
                }
                else if (this.dom.canvas.webkitRequestPointerLock) {
                    this.dom.canvas.webkitRequestPointerLock();
                }
                else {
                    console.error(`[${this.id}] Browser doesn't support pointer lock.`);
                    this.showError("Your browser doesn't support pointer lock.");
                }
            } catch (e) {
                console.error(`[${this.id}] Pointer lock request failed:`, e);
                this.showError("Mouse lock failed. Try clicking again.");
            }
        },

        /**
         * Handles mouse movement for camera control
         */
        handleMouseMove: function(event) {
            if (!this.state.controls.mouse.locked) {
                return;
            }

            if (!this.state.camera || !this.state.player || !this.state.player.object) {
                console.warn(`[${this.id}] Cannot handle mouse movement - required components missing.`);
                return;
            }

            // Get mouse movement
            let movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            let movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

            // Apply sensitivity
            movementX *= this.state.config.lookSpeed;
            movementY *= this.state.config.lookSpeed;

            // Store movement
            this.state.controls.mouse.x = movementX;
            this.state.controls.mouse.y = movementY;

            // Convert to rotation angles
            const yawDelta = movementX * 0.002;
            const pitchDelta = movementY * 0.002;

            // Apply yaw rotation to player object
            this.state.player.object.rotation.y -= yawDelta;

            // Apply pitch rotation to camera
            this.state.camera.rotation.x -= pitchDelta;

            // Clamp pitch to prevent flipping
            this.state.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.state.camera.rotation.x));
        },

        /**
         * Updates the info display with current game state
         */
        updateInfoDisplay: function(currentTime) {
            if (!this.dom.infoOverlay) {
                return;
            }

            const player = this.state.player;
            const world = this.state.world;

            // Calculate display values
            const speedMps = player.speed;
            const speedKmh = Math.round(speedMps * 3.6);

            // Prepare status strings
            const surf = player.onSurface ? 'YES' : 'NO';
            const ground = player.onGround ? 'YES' : 'NO';
            const jumpReady = player.canJump ? 'YES' : 'NO';
            const jumpActive = player.jumpInProgress ? 'YES' : 'NO';
            const jumpCooldown = Math.max(0, Math.round(player.jumpCooldownTimer));
            const surfState = player.surfingState === 0 ? 'NOT SURFING' : 
                            player.surfingState === 1 ? 'SURF TRANSITION' : 'FULL SURF';

            // Determine speed color
            let speedColor = 'white';
            if (speedKmh > 80) speedColor = '#ffff00';
            if (speedKmh > 180) speedColor = '#33ff66';
            if (speedKmh > 400) speedColor = '#00ffff';
            if (speedKmh > 800) speedColor = '#ff00ff';
            if (speedKmh > 1500) speedColor = '#ff3333';

            // Build HTML content
            this.dom.infoOverlay.innerHTML = `
                <strong>CS-Style Surf</strong><br>
                Speed: <span style="color: ${speedColor}">${speedKmh} km/h</span> (${Math.round(speedMps)} m/s)<br>
                Surfing: <span style="color: ${player.onSurface ? '#33ff66' : 'white'}">${surf}</span><br>
                Surf State: <span style="color: ${player.surfingState > 0 ? '#33ff66' : 'white'}">${surfState}</span><br>
                Grounded: <span style="color: ${player.onGround ? '#33ff66' : 'white'}">${ground}</span><br>
                Jump Ready: <span style="color: ${player.canJump ? '#33ff66' : 'white'}">${jumpReady}</span><br>
                Jump Active: <span style="color: ${player.jumpInProgress ? '#ff3333' : 'white'}">${jumpActive}</span><br>
                Jump Cooldown: ${jumpCooldown}ms<br>

                ${this.state.debug.showInfo ? `
                <span style="font-size: 10px; color: #cccccc;">
                Vel (XYZ): ${player.velocity.x.toFixed(1)}, ${player.velocity.y.toFixed(1)}, ${player.velocity.z.toFixed(1)}<br>
                Pos (XYZ): ${player.object.position.x.toFixed(0)}, ${player.object.position.y.toFixed(0)}, ${player.object.position.z.toFixed(0)}<br>
                </span>
                ` : ''}
                <br>
                <span style="color: #aaaaaa; font-size: 11px;">
                Click canvas to play<br>
                WASD - Move/Strafe<br>
                Mouse - Look/Turn<br>
                Space - Jump/Bhop<br>
                R - Reset position<br>
                I - Toggle debug info<br>
                </span>
            `;
        },

        /**
         * Cleans up resources when component is unloaded
         */
        cleanup: function() {
            console.log(`[${this.id}] Starting cleanup.`);

            // Pause the game
            if (this.state.running) {
                this.pause();
                console.log(`[${this.id}] Game paused during cleanup.`);
            }

            // Unsubscribe from framework events
            if (typeof Framework !== 'undefined' && typeof Framework.off === 'function') {
                this.state.subscriptions.forEach(sub => {
                    Framework.off(sub.event, sub.callback);
                    console.log(`[${this.id}] Unsubscribed from '${sub.event}'.`);
                });
                this.state.subscriptions = [];
            }

            // Remove event listeners
            if (this._handleResizeBound) {
                window.removeEventListener('resize', this._handleResizeBound);
                this._handleResizeBound = null;
                console.log(`[${this.id}] Window resize listener removed.`);
            }

            // Remove all control listeners
            this.removeControlListeners();

            // Dispose THREE.js resources
            if (this.state.scene) {
                this.state.scene.traverse(obj => {
                    if (obj.isMesh) {
                        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
                            obj.geometry.dispose();
                        }
                        if (obj.material) {
                            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                            materials.forEach(mat => {
                                if (mat) {
                                    for (const key in mat) {
                                        if (mat[key] && mat[key].isTexture && typeof mat[key].dispose === 'function') {
                                            mat[key].dispose();
                                        }
                                    }
                                    if (typeof mat.dispose === 'function') {
                                        mat.dispose();
                                    }
                                }
                            });
                        }
                    }
                });
                console.log(`[${this.id}] Scene objects disposed.`);

                // Clear scene
                while (this.state.scene.children.length > 0) {
                    this.state.scene.remove(this.state.scene.children[0]);
                }
                console.log(`[${this.id}] Scene cleared.`);
            }

            // Dispose renderer
            if (this.state.renderer) {
                this.state.renderer.dispose();
                this.state.renderer = null;
                console.log(`[${this.id}] Renderer disposed.`);
            }

            // Remove stats panel
            if (this.state.debug.stats) {
                if (this.state.debug.stats.dom && this.state.debug.stats.dom.parentElement) {
                    this.state.debug.stats.dom.parentElement.removeChild(this.state.debug.stats.dom);
                }
                this.state.debug.stats = null;
                console.log(`[${this.id}] Stats panel removed.`);
            }

            // Clear DOM references
            this.dom.content = null;
            this.dom.canvas = null;
            this.dom.loadingMessage = null;
            this.dom.errorMessage = null;
            this.dom.infoOverlay = null;

            // Mark as not initialized
            this.state.initialized = false;
            this.state.running = false;
            this.state.panelActive = false;

            console.log(`[${this.id}] Cleanup complete.`);
        },

        /**
         * Resets the player to starting position
         */
        resetPlayer: function() {
            if (!this.state.player || !this.state.player.object || !this.state.config || !this.state.clock || !this.state.scene || !this.state.world) {
                console.error(`[${this.id}] Cannot reset player - required components missing.`);
                return;
            }
            console.log(`[${this.id}] Resetting player to start.`);

            // Calculate starting position - FIXED to better position above the first ramp
            const startX = this.state.config.startPlatformPosition.x;
            // Add extra height to ensure player starts above the start platform
            const startY = this.state.config.startPlatformPosition.y + 
                         this.state.config.startPlatformHeight / 2 + 
                         this.state.config.playerHeight / 2 +
                         this.state.config.spawnHeightOffset; // Added height offset
            const startZ = this.state.config.startPlatformPosition.z; // Centered on the platform now

            // Position player
            this.state.player.object.position.set(startX, startY, startZ);

            // Update respawn point
            if (!this.state.world.respawnPoint) {
                this.state.world.respawnPoint = new THREE.Vector3(startX, startY, startZ);
            } else {
                this.state.world.respawnPoint.set(startX, startY, startZ);
            }

            // Reset physics state
            this.resetPlayerPhysics();

            console.log(`[${this.id}] Player reset to start complete.`);
        },

        /**
         * Resets the player to the current respawn point
         */
        resetPlayerToRespawn: function() {
            if (!this.state.player || !this.state.player.object || !this.state.world || !this.state.world.respawnPoint) {
                console.error(`[${this.id}] Cannot reset player to respawn - required components missing.`);
                return;
            }
            
            console.log(`[${this.id}] Resetting player to respawn point.`);
            
            // Position player at respawn point
            this.state.player.object.position.copy(this.state.world.respawnPoint);
            
            // Reset physics state
            this.resetPlayerPhysics();
            
            console.log(`[${this.id}] Player reset to respawn point complete.`);
        },

        /**
         * Resets the player's physics state
         */
        resetPlayerPhysics: function() {
            if (!this.state.player || !this.state.clock) {
                console.error(`[${this.id}] Cannot reset player physics - required components missing.`);
                return;
            }
            
            // Reset physics state
            this.state.player.velocity.set(0, 0, 0);
            this.state.player.previousVelocity.set(0, 0, 0);
            this.state.player.speed = 0;
            this.state.player.surfingState = 0;
            this.state.player.onGround = false; // Start in air to fall onto platform
            this.state.player.onSurface = false;
            this.state.player.canJump = false; // Can't jump until hitting ground
            this.state.player.jumpInProgress = false;
            this.state.player.jumpRequested = false;
            this.state.player.jumpCooldownTimer = 0;
            this.state.player.unstuckTimer = 0;
            this.state.player.contactCount = 0;
            this.state.player.prevSurfNormals = [new THREE.Vector3(0, 1, 0)];
            this.state.player.lastGroundTime = this.state.clock.elapsedTime;
            this.state.player.airAccelerationTimer = 0;
            
            if (this.state.config.jumpDebug) {
                console.log(`[${this.id}] Player physics state reset`);
            }
        }
    }; // End of component object

    // Register the component with the framework
    if (typeof Framework !== 'undefined' && typeof Framework.registerComponent === 'function') {
        Framework.registerComponent(component.id, component);
        console.log(`[${component.id}] Component registered with Framework.`);
    } else {
        console.error(`[${component.id}] Framework not found. Component not registered.`);
    }

})(); // End of IIFE