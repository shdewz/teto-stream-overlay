const socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');

const beatmaps = new Set();
let mappool;
(async () => {
    $.ajaxSetup({ cache: false });
    const stage = await $.getJSON('../../_data/beatmaps.json');
    mappool = stage.beatmaps;
    if (mappool) $('#round_label').text(stage.stage);
})();

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

const cache = {
    update_stats: false,
    stats_updated: false,
    setup_complete: false
};

const createMapLabel = (text, wrapper, inside, font_size, widths) => {
    const parent = $('<div></div>').addClass('map-stats-item clip-wrapper');
    if (wrapper) parent.addClass(`wrapper__${wrapper}`);

    const text_obj = $('<div></div>').addClass('clip-text').text(text);
    if (font_size) text_obj.css('font-size', font_size);
    if (widths?.min) text_obj.css('min-width', widths.min);
    if (widths?.max) text_obj.css('max-width', widths.max);

    const clip_style = 1 + Math.floor(Math.random() * 5);
    const clip_bg = 1 + Math.floor(Math.random() * 4);

    const inside_obj = $('<div></div>').addClass(`clip-inside clip-${clip_style} clip-bg-${clip_bg}`);
    if (inside) inside_obj.addClass(`inside__${inside}`);
    inside_obj.append(text_obj);

    parent.append($('<div></div>').addClass(`clip-container clip-${clip_style}`).append(inside_obj));
    return parent;
};

class Beatmap {
    constructor(beatmap) {
        this.id = beatmap.beatmap_id;
        this.beatmap = beatmap;
    }
    generate() {
        this.parent = $('<div></div>').addClass('map-background-outer-container').attr('id', `map-${this.beatmap.identifier.toLowerCase()}`).css('font-size', '14px');
        this.content = $('<div></div>').addClass('map-background-content');

        this.inner = $('<div></div>').addClass('map-background-inner-container');
        this.inner.append(
            $('<div></div>').addClass('map-background-container clip-wrapper').css('filter', 'none').append(
                $('<div></div>').addClass('clip-container clip-map').append(
                    $('<div></div>').addClass('clip-inside clip-map map-background').css('background-image', `url('https://assets.ppy.sh/beatmaps/${this.beatmap.beatmapset_id}/covers/cover.jpg')`)
                )
            )
        );
        this.inner.append($('<div></div>').addClass('map-teto').css('background-image', `url('../../_shared/assets/tetos/${this.beatmap.teto}.gif')`));
        this.content.append(this.inner);

        this.map_labels = $('<div></div>').addClass('map-labels');
        this.map_labels.append(createMapLabel(this.beatmap.identifier, 'slot', 'slot', '2.3em', null));
        this.map_labels.append(createMapLabel(this.beatmap.title, 'title', null, null, { min: '6.6em', max: '8.3em' }));
        this.map_labels.append(createMapLabel(this.beatmap.artist, 'artist', null, '0.83em', { min: '5em', max: '7.8em' }));
        this.map_labels.append(createMapLabel(`Diff [${this.beatmap.difficulty}]`, 'diff', null, '0.83em', { min: null, max: '7.1em' }));
        this.map_labels.append(createMapLabel('CS 0.0', 'cs', 'attrs', '0.75em', null));
        this.map_labels.append(createMapLabel('OD 0.0', 'od', 'attrs', '0.75em', null));
        this.map_labels.append(createMapLabel('AR 0.0', 'ar', 'attrs', '0.75em', null));
        this.map_labels.append(createMapLabel(`${this.beatmap.sr?.toFixed(2)}★`, 'sr', 'attrs', '0.75em', null));

        this.content.append(this.map_labels);
        this.parent.append(this.content);
    }
};

const setupBeatmaps = async () => {
    cache.setup_complete = true;
    console.log(mappool);
    if (!mappool || mappool.length == 0) return;

    $('#mappool_container').html('');

    for (const beatmap of mappool) {

        const bm = new Beatmap(beatmap);
        bm.generate();
        $('#mappool_container').append(bm.parent);

        bm.parent.on('click', event => {
            if (!event.originalEvent.shiftKey) event.originalEvent.ctrlKey ? banMap(bm) : pickMap(bm);
            else resetMap(bm);
        });
        beatmaps.add(bm);
    }
};

const pickedMaps = [];

const addToTimeline = (bm) => {
    const parent = $('<div></div>').addClass('map-timeline-item').attr('id', `timeline-${bm.id}`);
    parent.append($('<div></div>').addClass('map-timeline-slot').text(bm.beatmap.identifier));
    $('#map-timeline').append(parent);
};

const pickMap = (bm) => {
    bm.parent.removeClass('past banned').addClass('picked');
    if (pickedMaps.includes(bm)) {
        pickedMaps.splice(pickedMaps.indexOf(bm), 1);
        $(`#timeline-${bm.id}`).remove();
    }
    for (const pickedMap of pickedMaps) {
        pickedMap.parent.removeClass('banned picked').addClass('past');
    }
    if (!pickedMaps.includes(bm)) {
        pickedMaps.push(bm);
        addToTimeline(bm);
    }
};

const banMap = (bm) => {
    bm.parent.removeClass('past picked').addClass('banned');
    $(`#timeline-${bm.id}`).remove();
};

const resetMap = (bm) => {
    bm.parent.removeClass('past banned picked');
    $(`#timeline-${bm.id}`).remove();
};

socket.onmessage = async event => {
    const data = JSON.parse(event.data);

    if (mappool && !cache.setup_complete) setupBeatmaps();

    if (mappool && cache.md5 !== data.beatmap.checksum && !cache.stats_updated) {
        cache.md5 = data.beatmap.checksum;
        cache.stats_updated = true;
        setTimeout(() => { cache.update_stats = true; }, 500);
    }

    if (cache.update_stats) {
        cache.stats_updated = false;
        cache.update_stats = false;

        const map = mappool.find(m => m.beatmap_id === data.beatmap.id || m.md5 === cache.md5);
        $('#map_stats_slot').text(map?.identifier ?? 'XX');

        const mod_ = map?.mods || 'NM';
        const stats = getModStats(data.beatmap.stats.cs.original, data.beatmap.stats.ar.original, data.beatmap.stats.od.original, 0, mod_);

        $('#map_stats_cs').text('CS ' + (mod_ == 'FM' ? data.beatmap.stats.cs.original : map ? stats.cs : data.beatmap.stats.cs.converted).toFixed(1));
        $('#map_stats_ar').text('AR ' + (mod_ == 'FM' ? data.beatmap.stats.ar.original : map ? stats.ar : data.beatmap.stats.ar.converted).toFixed(1));
        $('#map_stats_od').text('OD ' + (mod_ == 'FM' ? data.beatmap.stats.od.original : map ? stats.od : data.beatmap.stats.od.converted).toFixed(1));
        $('#map_stats_sr').text((map?.sr || data.beatmap.stats.stars.total).toFixed(2) + '★');

        $('#map_stats_title').text(data.beatmap.title);
        $('#map_stats_artist').text(data.beatmap.artist);
        $('#map_stats_diff').text(`Diff [${data.beatmap.version}]`);
        $('#map_stats_mapper').text(`Mapset by ${map?.mapper ?? data.beatmap.mapper}`);

        if (map?.beatmapset_id) {
            $('#map_background').css('background-image', `url('https://assets.ppy.sh/beatmaps/${map?.beatmapset_id}/covers/cover@2x.jpg')`);
        }
        else {
            const path = `http://${location.host}/Songs/${data.folders.beatmap}/${data.files.background}`.replace(/#/g, '%23').replace(/%/g, '%25').replace(/\\/g, '/');
            $('#map_background').css('background-image', `url('${path}')`);
        }

        if (map?.teto) $('#teto').css('background-image', `url('../../_shared/assets/tetos/${map?.teto}.gif')`);
        else $('#teto').css('background-image', 'none');
    }

    if (cache.chatLen !== data.tourney.chat.length) {
        const current_chat_len = data.tourney.chat.length;
        if (cache.chatLen === 0 || (cache.chatLen > 0 && cache.chatLen > current_chat_len)) { $('#chat').html(''); cache.chatLen = 0; }

        for (let i = cache.chatLen || 0; i < current_chat_len; i++) {
            const chat = data.tourney.chat[i];
            const body = chat.message;
            const timestamp = chat.timestamp;
            if (body.toLowerCase().startsWith('!mp')) continue;

            const player = chat.name;
            if (player === 'BanchoBot' && body.startsWith('Match history')) continue;

            const chatParent = $('<div></div>').addClass(`chat-message ${chat.team}`);

            chatParent.append($('<div></div>').addClass('chat-time').text(timestamp));
            chatParent.append($('<div></div>').addClass(`chat-name ${chat.team}`).text(player));
            chatParent.append($('<div></div>').addClass('chat-body').text(body));
            $('#chat').prepend(chatParent);
        }

        cache.chatLen = data.tourney.chat.length;
        cache.chat_loaded = true;
    }
}

const getModStats = (cs_raw, ar_raw, od_raw, hp_raw, mods) => {
    let speed = mods.includes('DT') ? 1.5 : mods.includes('HT') ? 0.75 : 1;
    let ar = mods.includes('HR') ? ar_raw * 1.4 : mods.includes('EZ') ? ar_raw * 0.5 : ar_raw;
    let ar_ms = Math.max(Math.min(ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5), 1800), 450) / speed;
    ar = ar_ms > 1200 ? (1800 - ar_ms) / 120 : 5 + (1200 - ar_ms) / 150;

    let cs = Math.min(mods.includes('HR') ? cs_raw * 1.3 : mods.includes('EZ') ? cs_raw * 0.5 : cs_raw, 10);
    let hp = Math.min(mods.includes('HR') ? hp_raw * 1.4 : mods.includes('EZ') ? hp_raw * 0.5 : hp_raw, 10);

    let od = mods.includes('HR') ? Math.min(od_raw * 1.4, 10) : mods.includes('EZ') ? od_raw * 0.5 : od_raw;
    if (speed !== 1) od = Math.min((79.5 - (Math.min(79.5, Math.max(19.5, 79.5 - Math.ceil(6 * od))) / speed)) / 6, speed > 1.5 ? 12 : 11);

    return { cs, ar, od, hp, ar_ms }
}
