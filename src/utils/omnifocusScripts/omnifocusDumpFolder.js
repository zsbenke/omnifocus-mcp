// OmniJS script to export tasks from a specific folder in OmniFocus database
((folderIdParam) => {
    try {
      const startTime = new Date();
      
      // Helper function to format dates consistently or return null
      function formatDate(date) {
        if (!date) return null;
        return date.toISOString();
      }
  
      // Helper function to safely get enum values - Simplified with direct mapping
      const taskStatusMap = {
        [Task.Status.Available]: "Available",
        [Task.Status.Blocked]: "Blocked",
        [Task.Status.Completed]: "Completed",
        [Task.Status.Dropped]: "Dropped",
        [Task.Status.DueSoon]: "DueSoon",
        [Task.Status.Next]: "Next",
        [Task.Status.Overdue]: "Overdue"
      };
      
      const projectStatusMap = {
        [Project.Status.Active]: "Active",
        [Project.Status.Done]: "Done",
        [Project.Status.Dropped]: "Dropped",
        [Project.Status.OnHold]: "OnHold"
      };
      
      const folderStatusMap = {
        [Folder.Status.Active]: "Active",
        [Folder.Status.Dropped]: "Dropped"
      };
      
      function getEnumValue(enumObj, mapObj) {
        if (enumObj === null || enumObj === undefined) return null;
        return mapObj[enumObj] || "Unknown";
      }
      
      // Find the target folder if folderIdParam is provided
      let targetFolder = null;
      let folderIds = new Set();
      let projectIds = new Set();
      
      if (folderIdParam) {
        // Find the folder by ID
        targetFolder = flattenedFolders.find(folder => folder.id.primaryKey === folderIdParam);
        
        if (!targetFolder) {
          return JSON.stringify({
            success: false,
            error: `Folder with ID ${folderIdParam} not found`
          });
        }
        
        // Collect all folder IDs in the hierarchy (target folder and all subfolders)
        function collectFolderIds(folder) {
          folderIds.add(folder.id.primaryKey);
          folder.folders.forEach(subfolder => collectFolderIds(subfolder));
        }
        collectFolderIds(targetFolder);
        
        // Collect all project IDs in these folders
        function collectProjectIds(folder) {
          folder.projects.forEach(project => {
            projectIds.add(project.id.primaryKey);
          });
          folder.folders.forEach(subfolder => collectProjectIds(subfolder));
        }
        collectProjectIds(targetFolder);
      }
  
      // Create database export object using Maps for faster lookups
      const exportData = {
        exportDate: new Date().toISOString(),
        targetFolderId: folderIdParam || null,
        targetFolderName: targetFolder ? targetFolder.name : null,
        tasks: [],
        projects: {},
        folders: {},
        tags: {}
      };
  
      // Filter active projects - if folder specified, only include projects in that folder hierarchy
      const activeProjects = flattenedProjects.filter(project => {
        if (project.status === Project.Status.Done || project.status === Project.Status.Dropped) {
          return false;
        }
        if (folderIdParam) {
          return projectIds.has(project.id.primaryKey);
        }
        return true;
      });
      
      // Filter active folders - if folder specified, only include folders in hierarchy
      const activeFolders = flattenedFolders.filter(folder => {
        if (folder.status === Folder.Status.Dropped) {
          return false;
        }
        if (folderIdParam) {
          return folderIds.has(folder.id.primaryKey);
        }
        return true;
      });
      
      // Pre-filter active tags (we'll include all active tags as tasks might reference them)
      const activeTags = flattenedTags.filter(tag => tag.active);
      
      // Process projects in a single pass and store in Map for O(1) lookups
      const projectsMap = new Map();
      activeProjects.forEach(project => {
        try {
          const projectId = project.id.primaryKey;
          const projectData = {
            id: projectId,
            name: project.name,
            status: getEnumValue(project.status, projectStatusMap),
            folderID: project.parentFolder ? project.parentFolder.id.primaryKey : null,
            sequential: project.task.sequential || false,
            effectiveDueDate: formatDate(project.effectiveDueDate),
            effectiveDeferDate: formatDate(project.effectiveDeferDate),
            dueDate: formatDate(project.dueDate),
            deferDate: formatDate(project.deferDate),
            completedByChildren: project.completedByChildren,
            containsSingletonActions: project.containsSingletonActions,
            note: project.note || "",
            tasks: [] // Will be populated in the task loop
          };
          projectsMap.set(projectId, projectData);
          exportData.projects[projectId] = projectData;
        } catch (projectError) {
          // Silently handle project processing errors
        }
      });
  
      // Process folders in a single pass
      const foldersMap = new Map();
      activeFolders.forEach(folder => {
        try {
          const folderId = folder.id.primaryKey;
          const folderData = {
            id: folderId,
            name: folder.name,
            parentFolderID: folder.parent ? folder.parent.id.primaryKey : null,
            status: getEnumValue(folder.status, folderStatusMap),
            projects: [],
            subfolders: []
          };
          foldersMap.set(folderId, folderData);
          exportData.folders[folderId] = folderData;
        } catch (folderError) {
          // Silently handle folder processing errors
        }
      });
  
      // Process tags in a single pass
      const tagsMap = new Map();
      activeTags.forEach(tag => {
        try {
          const tagId = tag.id.primaryKey;
          const tagData = {
            id: tagId,
            name: tag.name,
            parentTagID: tag.parent ? tag.parent.id.primaryKey : null,
            active: tag.active,
            allowsNextAction: tag.allowsNextAction,
            tasks: []
          };
          tagsMap.set(tagId, tagData);
          exportData.tags[tagId] = tagData;
        } catch (tagError) {
          // Silently handle tag processing errors
        }
      });
  
      console.log("Building relationships and processing tasks simultaneously...");
      
      // Build folder relationships and project-folder relationships
      foldersMap.forEach((folder, folderId) => {
        if (folder.parentFolderID && foldersMap.has(folder.parentFolderID)) {
          const parentFolder = foldersMap.get(folder.parentFolderID);
          if (!parentFolder.subfolders.includes(folder.id)) {
            parentFolder.subfolders.push(folder.id);
          }
        }
      });
  
      // Pre-filter active tasks - if folder specified, only include tasks in projects within that folder hierarchy
      const activeTasks = flattenedTasks.filter(task => {
        if (task.taskStatus === Task.Status.Completed || task.taskStatus === Task.Status.Dropped) {
          return false;
        }
        if (folderIdParam && task.containingProject) {
          return projectIds.has(task.containingProject.id.primaryKey);
        }
        return !folderIdParam; // If no folder specified, include all active tasks
      });
      
      console.log(`Processing ${activeTasks.length} active tasks...`);
      
      // Process tasks with an optimized approach
      // Process in batches of 100 to prevent UI freezing
      const BATCH_SIZE = 100;
      
      for (let i = 0; i < activeTasks.length; i += BATCH_SIZE) {
        const taskBatch = activeTasks.slice(i, i + BATCH_SIZE);
        
        taskBatch.forEach(task => {
          try {
            // Get task data with minimal processing
            const taskTags = task.tags.map(tag => tag.id.primaryKey);
            const projectID = task.containingProject ? task.containingProject.id.primaryKey : null;
            
            const taskData = {
              id: task.id.primaryKey,
              name: task.name,
              note: task.note || "",
              taskStatus: getEnumValue(task.taskStatus, taskStatusMap),
              flagged: task.flagged,
              dueDate: formatDate(task.dueDate),
              deferDate: formatDate(task.deferDate),
              effectiveDueDate: formatDate(task.effectiveDueDate),
              effectiveDeferDate: formatDate(task.effectiveDeferDate),
              estimatedMinutes: task.estimatedMinutes,
              completedByChildren: task.completedByChildren,
              sequential: task.sequential || false,
              tags: taskTags,
              projectID: projectID,
              parentTaskID: task.parent ? task.parent.id.primaryKey : null,
              children: task.children.map(child => child.id.primaryKey),
              inInbox: task.inInbox
            };
  
            // Add task to export
            exportData.tasks.push(taskData);
  
            // Add task ID to associated project (if it exists)
            if (projectID && projectsMap.has(projectID)) {
              projectsMap.get(projectID).tasks.push(taskData.id);
              
              // Update folder-project relationship (only once per project)
              const project = projectsMap.get(projectID);
              if (project.folderID && foldersMap.has(project.folderID)) {
                const folder = foldersMap.get(project.folderID);
                if (!folder.projects.includes(project.id)) {
                  folder.projects.push(project.id);
                }
              }
            }
  
            // Add task ID to associated tags
            taskTags.forEach(tagID => {
              if (tagsMap.has(tagID)) {
                tagsMap.get(tagID).tasks.push(taskData.id);
              }
            });
          } catch (taskError) {
            // Silently handle task processing errors
          }
        });
      }
  
      // Return the complete database export
      const jsonData = JSON.stringify(exportData);
      return jsonData;

    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error exporting database: ${error}`
      });
    }
  }
)(__folderIdParam__);