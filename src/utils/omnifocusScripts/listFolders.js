// OmniJS script to list all folders in OmniFocus
(() => {
    try {
        // Helper function to get folder hierarchy path
        function getFolderPath(folder) {
            const path = [];
            let current = folder;
            
            while (current) {
                path.unshift(current.name);
                current = current.parent;
            }
            
            return path.join(' / ');
        }
        
        // Helper function to count tasks in a folder recursively
        function countTasksInFolder(folder) {
            let taskCount = 0;
            
            // Count tasks in all projects within this folder
            folder.projects.forEach(project => {
                // Only count active tasks
                project.tasks.forEach(task => {
                    if (task.taskStatus !== Task.Status.Completed && 
                        task.taskStatus !== Task.Status.Dropped) {
                        taskCount++;
                    }
                });
            });
            
            // Count tasks in subfolders
            folder.folders.forEach(subfolder => {
                taskCount += countTasksInFolder(subfolder);
            });
            
            return taskCount;
        }
        
        // Helper function to count projects in a folder recursively
        function countProjectsInFolder(folder) {
            let projectCount = 0;
            
            // Count active projects in this folder
            folder.projects.forEach(project => {
                if (project.status !== Project.Status.Done && 
                    project.status !== Project.Status.Dropped) {
                    projectCount++;
                }
            });
            
            // Count projects in subfolders
            folder.folders.forEach(subfolder => {
                projectCount += countProjectsInFolder(subfolder);
            });
            
            return projectCount;
        }
        
        // Get all active folders
        const folders = flattenedFolders.filter(folder => 
            folder.status !== Folder.Status.Dropped
        );
        
        // Build folder data
        const folderData = folders.map(folder => {
            return {
                id: folder.id.primaryKey,
                name: folder.name,
                path: getFolderPath(folder),
                parentId: folder.parent ? folder.parent.id.primaryKey : null,
                projectCount: countProjectsInFolder(folder),
                taskCount: countTasksInFolder(folder),
                hasSubfolders: folder.folders.length > 0
            };
        });
        
        // Sort folders by path for better organization
        folderData.sort((a, b) => a.path.localeCompare(b.path));
        
        return JSON.stringify({
            success: true,
            folders: folderData,
            totalCount: folderData.length
        });
        
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: `Error listing folders: ${error}`
        });
    }
})();