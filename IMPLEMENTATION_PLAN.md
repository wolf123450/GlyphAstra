# BlockBreaker Implementation Plan

## Project Overview
BlockBreaker is a desktop-based AI-assisted creative writing application combining a Vue.js frontend with Tauri for native desktop features and Ollama for local AI models.

**Tech Stack:**
- Frontend: Vue.js 3 + Tauri
- Backend Integration: Ollama API (local)
- Storage: Local file system + JSON metadata
- Styling: Dark/light mode compatible CSS

---

## Phase 1: Project Foundation & Setup ✅ COMPLETE

### 1.1 Development Environment & Project Structure ✅
- [x] Initialize Tauri project with Vue.js template
- [x] Set up project folder structure
  - `/src/components` - Vue components
  - `/src/pages` - Main pages
  - `/src/stores` - State management (Pinia) ✅
  - `/src/utils` - Helpers and utilities ✅
  - `/src/api` - Ollama API client ✅
  - `/src/styles` - Global styles
  - `/src-tauri/src` - Rust backend ✅
  - `/data` - Local story files
- [x] Configure Git and version control
- [x] Set up build and dev scripts

### 1.2 Tauri Backend Setup ✅
- [x] Configure Tauri security and permissions (file access, HTTP)
- [x] Set up Ollama connection module (Rust)
  - `check_ollama_connection()` command
  - `list_ollama_models()` command
- [x] Implement file system access layer
- [x] Create error handling and logging infrastructure

### 1.3 Frontend Scaffolding ✅
- [x] Set up Vue 3 with Composition API
- [x] Install and configure Pinia for state management
  - Created 5 stores: story, editor, settings, ai, ui
- [x] Create base layout components foundation ready
- [x] Set up dark/light mode toggle system (in uiStore)
- [x] Implement keyboard shortcut system foundation (in utils/keyboard.ts)

**Phase 1 Deliverables - COMPLETE:**
- ✅ Working dev environment with hot reload
- ✅ Tauri + Vue.js integration confirmed
- ✅ Pinia state management configured
- ✅ NPM build succeeds without errors
- ✅ Ollama API client ready (with connection check and model listing)
- ✅ File system utilities prepared
- ✅ Error handling and logging infrastructure in place
- ✅ Keyboard shortcut manager implemented

---

## Phase 2: Core UI Framework & Navigation (Week 3-4)

### 2.1 Main Application Shell ✅
- [x] Create main layout with 3-column structure:
  - Left sidebar (navigation) - **Sidebar.vue** ✅
  - Center panel (editor) - **Editor.vue** ✅
  - Optional right panel (story overview) - **Overview.vue** ✅
- [x] Implement responsive design for different screen sizes
- [x] Add minimize, maximize, close window controls

### 2.2 Theme System ✅
- [x] Implement dark/light mode toggle
- [x] Create consistent color palette
- [x] Add CSS variables for theming
- [x] Persist theme preference to local storage

### 2.3 Sidebar Navigation ✅
- [x] Create folder/chapter tree structure component
- [x] Implement folder expand/collapse
- [x] Add context menu (add chapter, delete, rename)
- [x] Visual indicators for:
  - Active chapter
  - Chapter status (draft, in-progress, complete)
  - Recent chapters (search functionality)

### 2.4 Keyboard Shortcuts ✅
- [x] Implement shortcut registry system
- [x] Core shortcuts:
  - Ctrl+N: New chapter
  - Ctrl+S: Save
  - Ctrl+F: Search
  - Ctrl+,: Settings
  - Tab: Toggle edit/preview mode

**Deliverables - COMPLETE:**
- ✅ Polished main UI shell
- ✅ Working navigation with full CRUD operations
- ✅ Theme system operational
- ✅ Obsidian-like aesthetic achieved
- ✅ All base components created and functional
- ✅ Frontend builds successfully

---

## Phase 3: File & Storage Management (Week 5-6)

### 3.1 Local File System Integration
- [ ] Create story directory structure:
  - `story.json` - Metadata and overview
  - `chapters/` - Folder structure matching UI
  - `chapters/chapter-name/` - Individual chapter files
  - `chapters/chapter-name/content.md` - Chapter content
- [ ] Implement file I/O operations through Tauri

### 3.2 Story Project System
- [ ] Create story initialization flow
- [ ] Load existing story projects
- [ ] Project metadata management:
  - Story title, description
  - Creation date, last modified
  - Theme/genre settings
- [ ] Basic folder and chapter CRUD operations

### 3.3 Chapter Operations
- [ ] Create new chapters
- [ ] Rename chapters with file system updates
- [ ] Delete chapters with confirmation
- [ ] Reorder chapters (update file references)
- [ ] Chapter properties (status, word count, metadata)

### 3.4 Auto-save System
- [ ] Debounced autosave on content changes
- [ ] Unsaved changes indicator
- [ ] Save conflict handling
- [ ] Recovery from crashes

**Deliverables:**
- Functional story project system
- Chapter management fully operational
- Local persistence working
- Auto-save system in place

---

## Phase 4: Markdown Editor & Preview System (Week 7-9)

### 4.1 Markdown Editor
- [ ] Integrate markdown editor component (e.g., CodeMirror or Ace)
- [ ] Syntax highlighting
- [ ] Line numbers
- [ ] Indentation and tab support
- [ ] Markdown formatting guides

### 4.2 Preview Rendering
- [ ] Integrate markdown renderer (e.g., marked + highlight.js)
- [ ] Real-time preview updates
- [ ] CSS styling for preview
- [ ] Support for:
  - Headers
  - Lists (ordered/unordered)
  - Bold/italic/strikethrough
  - Code blocks with syntax highlighting
  - Blockquotes
  - Links and images (local image support)

### 4.3 Edit/Preview Toggle
- [ ] Split view option (editor + preview side-by-side)
- [ ] Toggle between full edit and full preview
- [ ] Sync scroll between editor and preview
- [ ] Smooth transitions between modes

### 4.4 Inline Editing Mode
- [ ] Detect cursor position in preview
- [ ] Trigger inline edit mode when clicking text
- [ ] Edit text without switching to edit mode
- [ ] Save inline edits back to editor

**Deliverables:**
- Fully functional markdown editor
- Real-time preview system
- Smooth mode switching
- Professional editing experience

---

## Phase 5: Story Context & Overview System (Week 10-11)

### 5.1 Story Overview Panel
- [ ] Create story overview component:
  - Story summary (textarea)
  - Character profiles (list with add/edit/delete)
  - Settings/locations (list)
  - Plot points/themes (list)
  - Narrative voice and tone settings
- [ ] Real-time updates to `story.json`

### 5.2 Character Management
- [ ] Character profile structure:
  - Name, description, appearance
  - Personality traits
  - Role in story
  - First appearance chapter
- [ ] Character search integration

### 5.3 Context Embedding System
- [ ] Summarize completed chapters for context
- [ ] Extract key information to include in prompts:
  - Previous plot points
  - Character mentions
  - Story tone and style
  - Current narrative position
- [ ] Context window management (token counting)

### 5.4 Story Metadata Display
- [ ] Total word count calculation
- [ ] Chapter statistics
- [ ] Progress indicators
- [ ] Last modified dates

**Deliverables:**
- Complete story overview system
- Character management system
- Context extraction capabilities
- Story statistics tracking

---

## Phase 6: Ollama Integration & Basic AI (Week 12-14)

### 6.1 Ollama Connection
- [ ] Verify Ollama is running and accessible
- [ ] Create Ollama API client (Rust in Tauri)
- [ ] Implement connection health check
- [ ] Error handling for connection failures
- [ ] User notification for Ollama status

### 6.2 Model Management
- [ ] List available local models
- [ ] Model selection UI in settings
- [ ] Display model info (size, parameters, performance)
- [ ] Model download/pull functionality (if possible)
- [ ] Caching of model list

### 6.3 Basic Completion System
- [ ] Create completion prompt builder
- [ ] Simple text continuation feature
- [ ] Stream responses from Ollama
- [ ] Display generation progress
- [ ] Basic response formatting

### 6.4 Style Selection
- [ ] Create style configuration:
  - Predefined styles (mystical, sci-fi, romance, fantasy, noir, etc.)
  - Tone settings (formal, casual, dramatic, humorous)
  - Genre-specific parameters
- [ ] Store style preferences
- [ ] Include style in generation prompts

**Deliverables:**
- Working Ollama connection
- Model selection and management
- Basic text completion functional
- Style configuration system

---

## Phase 7: Advanced AI Features (Week 15-17)

### 7.1 Context-Aware Completions
- [ ] Include story overview in prompts
- [ ] Reference previous chapters in context
- [ ] Character consistency checking
- [ ] Plot continuity awareness
- [ ] Automatic context summarization

### 7.2 Completion Parameters
- [ ] Length control (short paragraph, medium section, long scene)
- [ ] Temperature adjustment (creativity level)
- [ ] Top-p and top-k parameters
- [ ] Max tokens configuration
- [ ] Number of suggestions (1-5)

### 7.3 Inline Completion Preview
- [ ] Show completion suggestions inline
- [ ] Accept/reject interface
- [ ] Insert selected completion
- [ ] Undo/redo for completions
- [ ] Completion history

### 7.4 Autocomplete Integration
- [ ] Detect user pause in typing
- [ ] Trigger auto-suggestions
- [ ] Non-intrusive suggestion display
- [ ] Quick accept/reject keyboard shortcuts

**Deliverables:**
- Full context-aware completions
- Multiple suggestion options working
- Intuitive accept/reject workflow
- Autocomplete system functional

---

## Phase 8: Search & Navigation Features (Week 18-19)

### 8.1 Full-Text Search
- [ ] Index all chapters
- [ ] Search across all chapters
- [ ] Display search results with context snippets
- [ ] Jump to result location
- [ ] Highlight matches

### 8.2 Advanced Search Filters
- [ ] Search by chapter
- [ ] Character search
- [ ] Setting/location search
- [ ] Date range filtering
- [ ] Regex support (optional)

### 8.3 Navigation Features
- [ ] Quick access to recent chapters
- [ ] Chapter history/breadcrumb
- [ ] Table of contents view
- [ ] Go to chapter search

**Deliverables:**
- Powerful search system
- Advanced filtering capabilities
- Quick navigation tools

---

## Phase 9: Settings & Customization (Week 20)

### 9.1 User Preferences
- [ ] Editor settings:
  - Font size
  - Font family
  - Line height
  - Tab width
- [ ] Theme customization
- [ ] Keyboard shortcut customization
- [ ] Auto-save interval settings

### 9.2 AI Settings
- [ ] Default model selection
- [ ] Default completion style
- [ ] Default parameters (temperature, length, etc.)
- [ ] Context window size preference
- [ ] Response temperature control

### 9.3 Advanced Controls
- [ ] Custom prompt templates
- [ ] Fine-tuning parameters
- [ ] Custom instruction templates
- [ ] Output post-processing options

**Deliverables:**
- Comprehensive settings panel
- Persistent user preferences
- Advanced AI controls

---

## Phase 10: Export & Data Management (Week 21-22)

### 10.1 Export Functionality
- [ ] Export to Markdown (single chapter or full story)
- [ ] Export to PDF (with formatting)
- [ ] Export to DOCX (with styling)
- [ ] Custom formatting options
- [ ] Chapter-by-chapter export

### 10.2 Backup & Recovery
- [ ] Manual backup creation
- [ ] Automatic backup scheduling
- [ ] Backup restoration
- [ ] Version history display
- [ ] Data integrity checking

### 10.3 Import Functionality
- [ ] Import Markdown files
- [ ] Import from DOCX
- [ ] Parse into chapter structure
- [ ] Metadata extraction

**Deliverables:**
- Full export/import system
- Multiple format support
- Backup and recovery working

---

## Phase 11: Performance Optimization & Polish (Week 23-24)

### 11.1 Performance Optimization
- [ ] Lazy loading for large stories
- [ ] Virtual scrolling for long chapter lists
- [ ] Memory optimization for large documents
- [ ] Efficient re-rendering
- [ ] Caching strategies for AI responses

### 11.2 UI Polish
- [ ] Animation refinements
- [ ] Loading states
- [ ] Success/error feedback
- [ ] Transition smoothness
- [ ] Accessibility (WCAG compliance)

### 11.3 Error Handling
- [ ] Comprehensive error messages
- [ ] Graceful degradation
- [ ] Recovery options
- [ ] Logging and diagnostics

### 11.4 Testing
- [ ] Unit tests for utilities
- [ ] Component tests for UI
- [ ] Integration tests for file operations
- [ ] Manual testing for AI features

**Deliverables:**
- Optimized, performant application
- Polish and refinement complete

---

## Phase 12: Advanced Features & Extensions (Week 25+)

### 12.1 Collaboration Features
- [ ] Version history tracking
- [ ] Commenting system
- [ ] Diff view between versions
- [ ] Change tracking

### 12.2 Advanced Context Management
- [ ] Semantic similarity search for context
- [ ] Automatic chapter summarization
- [ ] Key point extraction
- [ ] Context compression strategies

### 12.3 Analytics & Insights
- [ ] Writing statistics
- [ ] Completion usage analytics
- [ ] Style effectiveness tracking
- [ ] Progress visualization

### 12.4 Community Features
- [ ] Style sharing
- [ ] Template library
- [ ] Custom prompt sharing

**Deliverables:**
- Extended feature set
- Professional-grade application

---

## Technical Architecture Summary

### State Management (Pinia)
- `storyStore` - Story metadata and structure
- `editorStore` - Current editor state (content, cursor, mode)
- `settingsStore` - User preferences
- `aiStore` - AI models, settings, completions
- `uiStore` - UI state (theme, active chapter, etc.)

### Key APIs/Modules
- `ollama.ts` - Ollama API client
- `filesystem.ts` - File operations via Tauri
- `markdown.ts` - Markdown rendering and parsing
- `storage.ts` - Local storage management
- `context-builder.ts` - AI context assembly

### Storage Structure
```
story-project/
  story.json              # Metadata
  chapters/
    chapter-1/
      content.md          # Chapter content
      metadata.json       # Chapter properties
    chapter-2/
      content.md
      metadata.json
  backups/                # Automatic backups
  .backup/                # Auto-save recovery
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Ollama not installed | Check at startup, show setup guide |
| Large document performance | Pagination, lazy loading, virtual scrolling |
| Context window limitations | Automatic summarization, selective context building |
| File system access issues | Comprehensive error handling, recovery options |
| Data loss | Auto-save, versioning, backup system |
| Complex markdown | Progressive feature additions, test coverage |

---

## Success Metrics

- ✅ Desktop application launches without errors
- ✅ Story projects create and persist correctly
- ✅ Markdown rendering smooth and accurate
- ✅ AI completions generate in <10 seconds
- ✅ No lag with stories up to 100K words
- ✅ Seamless Tauri-Vue integration
- ✅ Professional UI matching Obsidian aesthetic
- ✅ All core features working without bugs

---

## Dependencies & Prerequisites

Before starting development:
1. Ollama installed and running locally
2. Node.js 16+ and npm/yarn
3. Rust 1.70+ (for Tauri)
4. Visual Studio Build Tools (Windows)
5. A code editor (VS Code recommended)

---

## Estimated Timeline

- **Total Duration:** 24-26 weeks (6 months) for core features
- **MVP (Phase 1-7):** 14 weeks (3.5 months)
- **Full Release (Phase 1-11):** 24 weeks (6 months)
- **Plus advanced features:** 25+ weeks

(Timelines are estimates and can vary based on complexity and team size)
