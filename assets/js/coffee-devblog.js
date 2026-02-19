function getDevblogEntries() {
    const entries = window.__COFFEE_DEVLOG__;
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries.slice();
}

function renderEntry(entry, options = {}) {
    const container = document.createElement('div');
    const title = document.createElement('p');
    title.innerHTML = `<i>${entry.title}</i>`;
    container.appendChild(title);

    (entry.body || []).forEach((line, index) => {
        const paragraph = document.createElement('p');
        const isLast = index === entry.body.length - 1;
        if (isLast && options.linkToComments) {
            paragraph.innerHTML = `<i><a href="${options.linkToComments}">${line}</a></i>`;
        } else {
            paragraph.innerHTML = `<i>${line}</i>`;
        }
        container.appendChild(paragraph);
    });

    return container;
}

function renderLatestUpdate() {
    const target = document.getElementById('coffee-latest-update');
    if (!target) {
        return;
    }
    const entries = getDevblogEntries();
    if (!entries.length) {
        return;
    }
    const latest = entries[0];
    const entryEl = renderEntry(latest, { linkToComments: './devblog/#comments' });
    target.innerHTML = '';
    target.appendChild(entryEl);
}

function renderDevblogList() {
    const list = document.getElementById('coffee-devblog-list');
    if (!list) {
        return;
    }
    const entries = getDevblogEntries();
    list.innerHTML = '';
    entries.forEach((entry) => {
        const entryWrapper = document.createElement('div');
        const entryEl = renderEntry(entry, { linkToComments: '#comments' });
        entryWrapper.appendChild(entryEl);
        list.appendChild(entryWrapper);
    });
}

renderLatestUpdate();
renderDevblogList();
