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
        
        // Initialize dark mode
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.updateTheme();
        
        this.bindEvents();
        this.render();
        
        // Hide editor initially if no notes
        this.noteEditor.style.display = this.notes.length ? 'flex' : 'none';
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
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
        
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
        }
    }

    updateCurrentNote() {
        if (!this.selectedNoteId) return;
        
        const note = this.notes.find(n => n.id === this.selectedNoteId);
        if (note) {
            note.title = this.noteTitleInput.value;
            note.content = this.noteContentInput.innerHTML;
            note.updatedAt = new Date().toISOString();
            
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
                            <button class="note-card-delete" title="Delete note">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <p>${this.stripHtml(note.content).substring(0, 100)}${note.content.length > 100 ? '...' : ''}</p>
                        <small>Last updated: ${this.formatDate(note.updatedAt)}</small>
                    </div>
                `).join('');
        }
    }
}

// Initialize the app
const app = new NotesApp(); 