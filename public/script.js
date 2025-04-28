let tasks = [];

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('todoForm');
    const list = document.getElementById('todoList');
    const sortSelect = document.getElementById('sortSelect');
    const logoutBtn = document.getElementById('logoutBtn');

    // Modal elements
    const modal = document.getElementById('editModal');
    const modalClose = document.querySelector('.modal-close');
    const modalForm = document.getElementById('editForm');
    const modalTask = document.getElementById('editTaskInput');
    const modalDate = document.getElementById('editDueDate');
    const modalPriority = document.getElementById('editPriority');
    const modalCategory = document.getElementById('editCategory');
    let currentEditId = null;

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const task = document.getElementById('taskInput').value;
            const due_date = document.getElementById('dueDate').value;
            const priority = document.getElementById('priority').value;
            const category = document.getElementById('category').value;

            await fetch('/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task, due_date, priority, category })
            });

            form.reset();
            fetchTasks();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            const key = sortSelect.value;
            const sorted = [...tasks].sort((a, b) => {
                if (key === 'due_date') return parseDateFromYMD(a.due_date) - parseDateFromYMD(b.due_date);
                return a[key].localeCompare(b[key]);
            });
            renderTasks(sorted);
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            fetch('/logout').then(() => window.location.href = '/');
        });
    }

    modalClose.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const updatedTask = {
            task: modalTask.value,
            due_date: modalDate.value,
            priority: modalPriority.value,
            category: modalCategory.value
        };
        updateTask(currentEditId, updatedTask);
        modal.style.display = 'none';
    });

    fetchTasks();

    function fetchTasks() {
        fetch('/tasks')
            .then(res => {
                if (!res.ok) {
                    if (res.status === 401) {
                        window.location.href = '/login.html';
                    }
                    throw new Error('Failed to fetch');
                }
                return res.json();
            })
            .then(data => {
                tasks = data;
                renderTasks(data);
            });
    }

    function renderTasks(taskList) {
        list.innerHTML = '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        taskList.forEach(task => {
            const li = document.createElement('li');
            li.className = 'todo-item';

            const dueDate = parseDateFromYMD(task.due_date);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today && !task.completed) {
                li.classList.add('overdue');
            }

            if (task.completed) li.classList.add('completed');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'styled-checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => {
                // Ensure due_date remains in correct format
                const safeDueDate = task.due_date?.split('T')[0] ?? null;

                updateTask(task.id, {
                    task: task.task,
                    due_date: safeDueDate,
                    priority: task.priority,
                    category: task.category,
                    completed: checkbox.checked
                });
            });

            const span = document.createElement('span');
            span.className = 'task-text';
            span.innerHTML = `
                <span>${task.task}</span>
                <span>${formatDate(task.due_date)}</span>
                <span>${task.priority}</span>
                <span>${task.category}</span>
            `;

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'edit-btn';
            editBtn.addEventListener('click', () => {
                currentEditId = task.id;
                modalTask.value = task.task;
                modalDate.value = task.due_date?.split('T')[0] ?? '';
                modalPriority.value = task.priority;
                modalCategory.value = task.category;
                modal.style.display = 'block';
            });

            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.className = 'delete-btn';
            delBtn.addEventListener('click', () => {
                if (confirm('Delete this task?')) {
                    deleteTask(task.id);
                }
            });

            li.appendChild(checkbox);
            li.appendChild(span);
            li.appendChild(editBtn);
            li.appendChild(delBtn);
            list.appendChild(li);
        });
    }

    function formatDate(dateString) {
        const date = parseDateFromYMD(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    }

    function parseDateFromYMD(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function updateTask(id, taskData) {
        fetch(`/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        }).then(fetchTasks);
    }

    function deleteTask(id) {
        fetch(`/tasks/${id}`, { method: 'DELETE' }).then(fetchTasks);
    }
});
