// OmniJS script to export OmniFocus data in TaskPaper format
((recordId, hideCompleted) => {
    try {
        // Helper to format dates for TaskPaper
        function formatDate(date) {
            if (!date) return null;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Helper to format time for TaskPaper
        function formatDateTime(date) {
            if (!date) return null;
            const dateStr = formatDate(date);
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            if (hours === '00' && minutes === '00') {
                return dateStr;
            }
            return `${dateStr} ${hours}:${minutes}`;
        }

        // Helper to format duration estimate
        function formatEstimate(minutes) {
            if (!minutes) return null;
            if (minutes < 60) return `${minutes}m`;
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            if (remainingMinutes === 0) return `${hours}h`;
            return `${hours}h${remainingMinutes}m`;
        }

        // Build TaskPaper line for a task
        function taskToTaskPaper(task, indent) {
            let line = indent + '- ' + task.name;

            // Add tags
            if (task.tags.length > 0) {
                line += ' @tags(' + task.tags.map(t => t.name).join(', ') + ')';
            }

            // Add flagged
            if (task.flagged) {
                line += ' @flagged';
            }

            // Add due date
            if (task.dueDate) {
                line += ' @due(' + formatDateTime(task.dueDate) + ')';
            }

            // Add defer date
            if (task.deferDate) {
                line += ' @defer(' + formatDateTime(task.deferDate) + ')';
            }

            // Add estimate
            if (task.estimatedMinutes) {
                line += ' @estimate(' + formatEstimate(task.estimatedMinutes) + ')';
            }

            // Add parallel/sequential
            if (task.sequential === false) {
                line += ' @parallel(true)';
            }

            // Add autodone
            if (task.completedByChildren) {
                line += ' @autodone(true)';
            }

            // Add done date for completed tasks
            if (task.completed && task.completionDate) {
                line += ' @done(' + formatDate(task.completionDate) + ')';
            }

            return line;
        }

        // Recursively process tasks
        function processTasks(tasks, indent, hideCompleted) {
            let output = '';
            tasks.forEach(task => {
                // Skip completed or dropped if hideCompleted is true
                if (hideCompleted && (task.completed || task.taskStatus === Task.Status.Dropped)) {
                    return;
                }

                output += taskToTaskPaper(task, indent) + '\n';

                // Add note as indented text
                if (task.note && task.note.trim()) {
                    const noteIndent = indent + '\t';
                    task.note.split('\n').forEach(noteLine => {
                        if (noteLine.trim()) {
                            output += noteIndent + noteLine + '\n';
                        }
                    });
                }

                // Process child tasks
                if (task.tasks && task.tasks.length > 0) {
                    output += processTasks(task.tasks, indent + '\t', hideCompleted);
                }
            });
            return output;
        }

        // Build TaskPaper for a project
        function projectToTaskPaper(project, hideCompleted) {
            let output = project.name + ':';

            // Add project-level tags
            if (project.tags && project.tags.length > 0) {
                output += ' @tags(' + project.tags.map(t => t.name).join(', ') + ')';
            }

            // Add project-level attributes
            if (project.dueDate) {
                output += ' @due(' + formatDateTime(project.dueDate) + ')';
            }
            if (project.deferDate) {
                output += ' @defer(' + formatDateTime(project.deferDate) + ')';
            }
            if (project.flagged) {
                output += ' @flagged';
            }
            if (!project.sequential) {
                output += ' @parallel(true)';
            }
            if (project.completedByChildren) {
                output += ' @autodone(true)';
            }
            if (project.status === Project.Status.Done && project.completionDate) {
                output += ' @done(' + formatDate(project.completionDate) + ')';
            }

            output += '\n';

            // Add project note
            if (project.note && project.note.trim()) {
                project.note.split('\n').forEach(noteLine => {
                    if (noteLine.trim()) {
                        output += '\t' + noteLine + '\n';
                    }
                });
            }

            // Process tasks
            output += processTasks(project.tasks, '\t', hideCompleted);

            return output;
        }

        // Build TaskPaper for a folder recursively
        function folderToTaskPaper(folder, hideCompleted, depth) {
            let output = '';
            const headerPrefix = '#'.repeat(depth) + ' ';

            output += headerPrefix + folder.name + '\n\n';

            // Process projects in folder
            folder.projects.forEach(project => {
                if (hideCompleted && (project.status === Project.Status.Done || project.status === Project.Status.Dropped)) {
                    return;
                }
                output += projectToTaskPaper(project, hideCompleted) + '\n';
            });

            // Process subfolders
            folder.folders.forEach(subfolder => {
                output += folderToTaskPaper(subfolder, hideCompleted, depth + 1);
            });

            return output;
        }

        // Main export logic
        let taskpaperOutput = '';

        if (recordId && recordId !== 'null' && recordId !== 'undefined') {
            // Export specific record by ID
            let found = false;

            // Try to find as project
            flattenedProjects.forEach(project => {
                if (project.id.primaryKey === recordId) {
                    taskpaperOutput = projectToTaskPaper(project, hideCompleted);
                    found = true;
                }
            });

            // Try to find as folder
            if (!found) {
                flattenedFolders.forEach(folder => {
                    if (folder.id.primaryKey === recordId) {
                        taskpaperOutput = folderToTaskPaper(folder, hideCompleted, 1);
                        found = true;
                    }
                });
            }

            // Try to find as task (export containing project)
            if (!found) {
                flattenedTasks.forEach(task => {
                    if (task.id.primaryKey === recordId) {
                        if (task.containingProject) {
                            taskpaperOutput = projectToTaskPaper(task.containingProject, hideCompleted);
                        } else {
                            // Inbox task - just export the task
                            taskpaperOutput = taskToTaskPaper(task, '') + '\n';
                            if (task.note && task.note.trim()) {
                                task.note.split('\n').forEach(noteLine => {
                                    if (noteLine.trim()) {
                                        taskpaperOutput += '\t' + noteLine + '\n';
                                    }
                                });
                            }
                            taskpaperOutput += processTasks(task.tasks, '\t', hideCompleted);
                        }
                        found = true;
                    }
                });
            }

            if (!found) {
                return JSON.stringify({
                    success: false,
                    error: 'Record not found: ' + recordId
                });
            }
        } else {
            // Export everything
            taskpaperOutput = '# OmniFocus Export\n\n';

            // Export inbox first
            const inboxTasks = inbox.filter(task =>
                !hideCompleted || !task.completed
            );

            if (inboxTasks.length > 0) {
                taskpaperOutput += '## Inbox\n\n';
                taskpaperOutput += processTasks(inboxTasks, '', hideCompleted);
                taskpaperOutput += '\n';
            }

            // Export library (top-level folders and projects)
            library.folders.forEach(folder => {
                taskpaperOutput += folderToTaskPaper(folder, hideCompleted, 2);
            });

            library.projects.forEach(project => {
                if (hideCompleted && (project.status === Project.Status.Done || project.status === Project.Status.Dropped)) {
                    return;
                }
                taskpaperOutput += projectToTaskPaper(project, hideCompleted) + '\n';
            });
        }

        return JSON.stringify({
            success: true,
            taskpaper: taskpaperOutput,
            exportDate: new Date().toISOString()
        });

    } catch (error) {
        return JSON.stringify({
            success: false,
            error: 'Error exporting TaskPaper: ' + error
        });
    }
})(
    __recordIdParam__,
    __hideCompletedParam__
);
