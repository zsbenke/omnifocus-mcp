// OmniJS script to export inbox tasks from OmniFocus database - Optimized
(() => {
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
      
      function getEnumValue(enumObj, mapObj) {
        if (enumObj === null || enumObj === undefined) return null;
        return mapObj[enumObj] || "Unknown";
      }
  
      // Create database export object
      const exportData = {
        exportDate: new Date().toISOString(),
        tasks: [],
        tags: {}
      };
  
      // Get only inbox tasks - tasks that are not in any project and are not completed/dropped
      const topLevelInboxTasks = flattenedTasks.filter(task => 
        task.inInbox &&
        task.taskStatus !== Task.Status.Completed && 
        task.taskStatus !== Task.Status.Dropped
      );
      
      // Function to recursively get all tasks (including subtasks)
      function getAllTasksWithChildren(tasks) {
        let allTasks = [];
        
        tasks.forEach(task => {
          // Add the task itself
          allTasks.push(task);
          
          // Recursively add all children
          if (task.children && task.children.length > 0) {
            const childTasks = task.children.filter(child => 
              child.taskStatus !== Task.Status.Completed && 
              child.taskStatus !== Task.Status.Dropped
            );
            allTasks = allTasks.concat(getAllTasksWithChildren(childTasks));
          }
        });
        
        return allTasks;
      }
      
      // Get all inbox tasks including subtasks
      const inboxTasks = getAllTasksWithChildren(topLevelInboxTasks);
      
      // Get active tags
      const activeTags = flattenedTags.filter(tag => tag.active);
      
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
  
      console.log(`Processing ${inboxTasks.length} inbox tasks (including subtasks)...`);
      
      // Process tasks with an optimized approach
      // Process in batches of 100 to prevent UI freezing
      const BATCH_SIZE = 100;
      
      for (let i = 0; i < inboxTasks.length; i += BATCH_SIZE) {
        const taskBatch = inboxTasks.slice(i, i + BATCH_SIZE);
        
        taskBatch.forEach(task => {
          try {
            // Get task data with minimal processing
            const taskTags = task.tags.map(tag => tag.id.primaryKey);
            
            const taskData = {
              id: task.id.primaryKey,
              name: task.name,
              note: task.note || "",
              taskStatus: getEnumValue(task.taskStatus, taskStatusMap),
              flagged: task.flagged,
              dueDate: formatDate(task.dueDate),
              deferDate: formatDate(task.deferDate),
              creationDate: formatDate(task.added),
              modificationDate: formatDate(task.modified),
          lastReviewDate: null,
              effectiveDueDate: formatDate(task.effectiveDueDate),
              effectiveDeferDate: formatDate(task.effectiveDeferDate),
              estimatedMinutes: task.estimatedMinutes,
              completedByChildren: task.completedByChildren,
              sequential: task.sequential || false,
              tags: taskTags,
              tagNames: task.tags.map(tag => tag.name),
              projectId: null, // Inbox tasks don't have projects
              parentId: task.parent ? task.parent.id.primaryKey : null,
              childIds: task.children.map(child => child.id.primaryKey),
              inInbox: task.inInbox || false
            };
  
            // Add task to export
            exportData.tasks.push(taskData);
  
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
  
      // Return the complete inbox export
      const jsonData = JSON.stringify(exportData);
      return jsonData;

    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error exporting inbox: ${error}`
      });
    }
  }
)();