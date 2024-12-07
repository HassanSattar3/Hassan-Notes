class NotesApp {
    constructor() {
        this.notes = JSON.parse(localStorage.getItem('notes')) || [];
        this.selectedNoteId = null;
        this.notesContainer = document.getElementById('notesContainer');
        this.emptyState = document.getElementById('emptyState');
        this.newNoteBtn = document.getElementById('newNoteBtn');
        this.noteEditor = document.getElementById('noteEditor');
        this.noteTitleInput = document.getElementById('noteTitleInput');
        this.noteContentInput = document.getElementById('noteContentInput');
        this.searchInput = document.getElementById('searchInput');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.deleteNoteBtn = document.getElementById('deleteNoteBtn');
        this.collaboratorsIndicator = document.getElementById('collaboratorsIndicator');
        this.activeCollaborators = 0;
        this.ws = null;
        this.isTyping = false;
        this.typingTimeout = null;
        
        // Initialize dark mode
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.updateTheme();
        
        this.bindEvents();
        this.render();
        
        // Always hide editor initially
        this.noteEditor.style.display = 'none';
        
        // Only check URL params after a small delay to prevent initial selection on PWA
        setTimeout(() => this.initializeFromUrl(), 100);
    }

    bindEvents() {
        this.newNoteBtn.addEventListener('click', () => this.createNewNote());
        this.notesContainer.addEventListener('click', (e) => {
            const noteCard = e.target.closest('.note-card');
            const deleteBtn = e.target.closest('.note-card-delete');
            
            if (deleteBtn) {
                e.stopPropagation(); // Prevent note selection when clicking delete
                const noteId = deleteBtn.closest('.note-card').dataset.id;
                const note = this.notes.find(n => n.id === noteId);
                if (note) {
                    const confirmDelete = confirm(`Are you sure you want to delete "${note.title || 'Untitled Note'}"?`);
                    if (confirmDelete) {
                        this.deleteNote(noteId);
                    }
                }
            } else if (noteCard) {
                this.selectNote(noteCard.dataset.id);
            }
        });

        // Auto-save on input
        this.noteTitleInput.addEventListener('input', () => this.updateCurrentNote());
        this.noteContentInput.addEventListener('input', () => this.updateCurrentNote());

        // Search functionality
        this.searchInput.addEventListener('input', () => this.handleSearch());

        // Dark mode toggle
        this.darkModeToggle.addEventListener('click', () => this.toggleDarkMode());

        // Delete note
        this.deleteNoteBtn.addEventListener('click', () => this.handleDeleteNote());

        // Format buttons
        document.querySelectorAll('.toolbar-btn').forEach(button => {
            button.addEventListener('click', () => {
                const command = button.dataset.command;
                this.formatText(command);
                button.classList.toggle('active');
            });
        });
    }

    handleDeleteNote() {
        if (!this.selectedNoteId) return;

        const note = this.notes.find(n => n.id === this.selectedNoteId);
        if (!note) return;

        const confirmDelete = confirm(`Are you sure you want to delete "${note.title || 'Untitled Note'}"?`);
        if (confirmDelete) {
            this.deleteNote(this.selectedNoteId);
        }
    }

    formatText(command) {
        document.execCommand(command, false, null);
        this.noteContentInput.focus();
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        this.updateTheme();
    }

    updateTheme() {
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
        this.darkModeToggle.innerHTML = this.isDarkMode ? 
            '<i class="fas fa-sun" title="Switch to light mode"></i>' : 
            '<i class="fas fa-moon" title="Switch to dark mode"></i>';
        
        // Update PWA theme color based on dark/light mode
        const themeColor = this.isDarkMode ? '#00d488' : '#00b377';
        document.querySelector('meta[name="theme-color"]').setAttribute('content', themeColor);
    }

    handleSearch() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const filteredNotes = searchTerm ? 
            this.notes.filter(note => 
                note.title.toLowerCase().includes(searchTerm) || 
                note.content.toLowerCase().includes(searchTerm)
            ) : this.notes;
        
        this.render(filteredNotes);
    }

    createNewNote() {
        const note = {
            id: Date.now().toString(),
            title: 'Untitled Note',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.render();
        this.selectNote(note.id);
    }

    selectNote(noteId) {
        // Disconnect from previous WebSocket if exists
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.selectedNoteId = noteId;
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            this.noteTitleInput.value = note.title;
            this.noteContentInput.innerHTML = note.content;
            this.noteEditor.style.display = 'flex';
            this.render();
            
            // Focus the title if it's a new note
            if (note.title === 'Untitled Note' && !note.content) {
                this.noteTitleInput.focus();
            }

            // Connect to WebSocket for real-time collaboration
            this.connectToWebSocket(noteId);
        }
    }

    connectToWebSocket(noteId) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?noteId=${noteId}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'collaborators') {
                this.updateCollaboratorsCount(data.count);
            } else {
                this.handleCollaborativeUpdate(data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onopen = () => {
            this.updateCollaboratorsIndicator(true);
        };

        this.ws.onclose = () => {
            this.updateCollaboratorsIndicator(false);
        };
    }

    updateCollaboratorsCount(count) {
        this.activeCollaborators = count;
        this.updateCollaboratorsIndicator(true);
    }

    updateCollaboratorsIndicator(connected) {
        if (!connected) {
            this.collaboratorsIndicator.innerHTML = '';
            return;
        }

        if (this.activeCollaborators > 0) {
            this.collaboratorsIndicator.innerHTML = `
                <div class="collaborator-dot"></div>
                <span class="collaborator-count">${this.activeCollaborators} collaborator${this.activeCollaborators !== 1 ? 's' : ''} online</span>
            `;
        } else {
            this.collaboratorsIndicator.innerHTML = '';
        }
    }

    handleCollaborativeUpdate(data) {
        const note = this.notes.find(n => n.id === this.selectedNoteId);
        if (!note) return;

        if (data.type === 'title') {
            note.title = data.content;
            this.noteTitleInput.value = data.content;
        } else if (data.type === 'content') {
            note.content = data.content;
            this.noteContentInput.innerHTML = data.content;
        }

        note.updatedAt = new Date().toISOString();
        this.saveNotes();
        this.render();
    }

    updateCurrentNote() {
        if (!this.selectedNoteId) return;
        
        const note = this.notes.find(n => n.id === this.selectedNoteId);
        if (note) {
            const title = this.noteTitleInput.value;
            const content = this.noteContentInput.innerHTML;

            note.title = title;
            note.content = content;
            note.updatedAt = new Date().toISOString();
            
            // Send updates through WebSocket
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Debounce content updates to prevent flooding
                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    this.ws.send(JSON.stringify({
                        type: 'title',
                        content: title
                    }));
                    this.ws.send(JSON.stringify({
                        type: 'content',
                        content: content
                    }));
                }, 300);
            }
            
            this.saveNotes();
            this.render();
        }
    }

    deleteNote(noteId) {
        this.notes = this.notes.filter(note => note.id !== noteId);
        if (this.selectedNoteId === noteId) {
            this.selectedNoteId = null;
            this.noteEditor.style.display = 'none';
            this.noteTitleInput.value = '';
            this.noteContentInput.innerHTML = '';
        }
        this.saveNotes();
        this.render();
    }

    saveNotes() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
    }

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    render(notesToRender = this.notes) {
        if (notesToRender.length === 0) {
            this.notesContainer.style.display = 'none';
            this.emptyState.style.display = 'flex';
            if (!this.selectedNoteId) {
                this.noteEditor.style.display = 'none';
            }
        } else {
            this.notesContainer.style.display = 'flex';
            this.emptyState.style.display = 'none';

            this.notesContainer.innerHTML = notesToRender
                .map(note => `
                    <div class="note-card ${note.id === this.selectedNoteId ? 'selected' : ''}" 
                         data-id="${note.id}">
                        <div class="note-card-header">
                            <h3>${note.title || 'Untitled Note'}</h3>
                            <div class="note-card-actions">
                                <button class="note-card-share" title="Share note">
                                    <i class="fas fa-share-alt"></i>
                                </button>
                                <button class="note-card-delete" title="Delete note">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <p>${this.stripHtml(note.content).substring(0, 100)}${note.content.length > 100 ? '...' : ''}</p>
                        <small>Last updated: ${this.formatDate(note.updatedAt)}</small>
                    </div>
                `).join('');

            // Add share button event listeners
            document.querySelectorAll('.note-card-share').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const noteId = e.target.closest('.note-card').dataset.id;
                    this.shareNote(noteId);
                });
            });
        }
    }

    async shareNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const shareUrl = `${window.location.origin}${window.location.pathname}?note=${noteId}`;
        
        // Check if running as PWA
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone;

        try {
            if (navigator.share && !isPWA) {
                // Use Web Share API if available and not running as PWA
                await navigator.share({
                    title: note.title,
                    text: 'Check out this note!',
                    url: shareUrl
                });
            } else {
                // Fallback to custom share dialog
                this.showShareDialog(shareUrl, note.title);
            }
        } catch (error) {
            console.error('Sharing failed:', error);
            this.showShareDialog(shareUrl, note.title);
        }
    }

    showShareDialog(shareUrl, noteTitle) {
        // Create and show a custom share dialog
        const dialog = document.createElement('div');
        dialog.className = 'share-dialog';
        dialog.innerHTML = `
            <div class="share-dialog-content">
                <h3>Share "${noteTitle}"</h3>
                <div class="share-options">
                    <button class="share-option" data-action="copy">
                        <i class="fas fa-copy"></i>
                        Copy Link
                    </button>
                    <button class="share-option" data-action="email">
                        <i class="fas fa-envelope"></i>
                        Email
                    </button>
                    <button class="share-option" data-action="messages">
                        <i class="fas fa-comment"></i>
                        Messages
                    </button>
                </div>
                <button class="share-dialog-close">Close</button>
            </div>
        `;

        // Add event listeners for share options
        dialog.querySelector('[data-action="copy"]').addEventListener('click', () => {
            navigator.clipboard.writeText(shareUrl)
                .then(() => {
                    alert('Link copied to clipboard!');
                    document.body.removeChild(dialog);
                })
                .catch(err => alert('Failed to copy link'));
        });

        dialog.querySelector('[data-action="email"]').addEventListener('click', () => {
            window.location.href = `mailto:?subject=${encodeURIComponent(noteTitle)}&body=${encodeURIComponent(shareUrl)}`;
            document.body.removeChild(dialog);
        });

        dialog.querySelector('[data-action="messages"]').addEventListener('click', () => {
            window.location.href = `sms:&body=${encodeURIComponent(shareUrl)}`;
            document.body.removeChild(dialog);
        });

        dialog.querySelector('.share-dialog-close').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });

        // Close dialog when clicking outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });

        document.body.appendChild(dialog);
    }

    initializeFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedNoteId = urlParams.get('note');
        
        if (sharedNoteId) {
            const note = this.notes.find(n => n.id === sharedNoteId);
            if (note) {
                this.selectNote(sharedNoteId);
                // Clean the URL without reloading the page
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }
}

// Initialize the app
const app = new NotesApp(); 