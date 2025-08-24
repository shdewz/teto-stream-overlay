// const socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');
const socket = new ReconnectingWebSocket('ws://127.0.0.1:24051/'); // for debug

let mappool;
(async () => {
    $.ajaxSetup({ cache: false });
    const stage = await $.getJSON('../../_data/beatmaps.json');
    mappool = stage.beatmaps;
    if (mappool) {
        $('#round_label').text(stage.stage);
        for (const map of mappool) {
            if (map.teto) {
                setTimeout(() => {
                    addTetoFish(map.teto);
                }, Math.random() * 10000);
            }
        }
    }
})();

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

const cache = {
    setup_complete: false,
    last_leaderboard_update: 0,
    chat_enabled: false
};

const clients = new Map();
const leaderboard = new Map();
const eliminated = [];
const leaderboard_obj = document.getElementById('leaderboard');

const createClientLabel = (client, type, font_size, width, placeholder) => {
    const clip_style = 1 + Math.floor(Math.random() * 5);
    const clip_bg = 1 + Math.floor(Math.random() * 4);

    const parent = $('<div></div>').addClass(`clip-container clip-${clip_style} label__${type}`);
    const inside_obj = $('<div></div>').addClass(`clip-inside clip-${clip_style} clip-bg-${clip_bg}`);

    const text_obj = $('<div></div>').addClass('clip-text').attr('id', `client${client}_${type}`).text(placeholder ?? '');
    text_obj.css({ 'font-size': font_size, 'width': width });
    if (type === 'name') text_obj.attr('contenteditable', 'true');
    if (font_size) text_obj.css('font-size', font_size);
    if (width) text_obj.css('width', width);

    inside_obj.append(text_obj);
    parent.append(inside_obj);
    return parent;
};

class GameplayClient {
    constructor(id) {
        this.id = id;
    }
    generate() {
        this.parent = $('<div></div>').addClass('gameplay-client').attr('id', `client${this.id}`);
        this.content = $('<div></div>').addClass('gameplay-content');
        this.labels = $('<div></div>').addClass('gameplay-labels');

        this.labels.append(createClientLabel(this.id, 'name', '0.85em', '180px', `Player ${this.id}`));
        this.labels.append(createClientLabel(this.id, 'combo', '0.85em', '70px', '0x'));
        this.labels.append(createClientLabel(this.id, 'score', '0.8em', '100px', '0'));
        this.labels.append(createClientLabel(this.id, 'acc', '0.7em', '60px', '0.00%'));

        this.content.append(this.labels);
        this.parent.append(this.content);

        this.animation = {
            score: new CountUp(`client${this.id}_score`, 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '' }),
            acc: new CountUp(`client${this.id}_acc`, 0, 0, 2, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '%' }),
            combo: new CountUp(`client${this.id}_combo`, 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: '', decimal: '.', suffix: 'x' }),
        };
    }
};

class LeaderboardItem {
    constructor(player) {
        this.id = player.id;
        this.player = player;
    }
    generate() {
        this.parent = $('<div></div>').addClass('leaderboard-item').attr('id', `lb_${this.id}`).attr('data-pid', this.id);
        this.parent.append($('<div></div>').addClass('leaderboard-rank').text('0').attr('id', `lb_rank_${this.id}`));

        this.data_obj = $('<div></div>').addClass('leaderboard-data');
        this.data_obj.append($('<div></div>').addClass('leaderboard-name').text(`${this.player.name}`));
        this.data_obj.append($('<div></div>').addClass('leaderboard-score').text('0').attr('id', `lb_score_${this.id}`));
        this.animation = new CountUp(`lb_score_${this.id}`, 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '' });

        this.parent.append(this.data_obj);
        this.score = 0;
    }
};

const setupClients = () => {
    cache.setup_complete = true;
    if (!mappool || mappool.length == 0) return;

    $('#gameplay_area').html('');

    for (let i = 0; i < 12; i++) {
        const client = new GameplayClient(i + 1);
        client.generate();
        $('#gameplay_area').append(client.parent);

        client.parent.on('click', event => {
            if (event.originalEvent.ctrlKey) eliminateClient(client);
            else if (event.originalEvent.shiftKey) resetClient(client);
        });
        clients.set(i + 1, client);
    }
};

const eliminateClient = (client) => {
    client.parent.addClass('eliminated');
    const client_obj = clients.get(client.id);
    client_obj.animation.score.update(0);
    client_obj.animation.acc.update(0);
    client_obj.animation.combo.update(0);
    eliminated.push(client.id);
};

const resetClient = (client) => {
    client.parent.removeClass('eliminated');
    eliminated.splice(eliminated.indexOf(client.id), 1);
};

socket.onmessage = async event => {
    const data = JSON.parse(event.data);
    const now = Date.now();

    if (cache.scoreVisible !== data.tourney.scoreVisible) {
        cache.scoreVisible = data.tourney.scoreVisible;
    }

    if (mappool && !cache.setup_complete) setupClients();
    if (mappool && cache.md5 !== data.beatmap.checksum && !cache.stats_updated) {
        cache.md5 = data.beatmap.checksum;
        cache.stats_updated = true;
        setTimeout(() => { cache.update_stats = true; }, 500);
    }

    if (cache.update_stats) {
        cache.stats_updated = false;
        cache.update_stats = false;

        cache.map = mappool.find(m => m.beatmap_id === data.beatmap.id || m.md5 === cache.md5);
        $('#map_stats_slot').text(cache.map?.identifier ?? 'XX');

        $('#map_stats_title').text(data.beatmap.title);
        $('#map_stats_artist').text(data.beatmap.artist);

        if (cache.map?.beatmapset_id) {
            $('#map_background').css('background-image', `url('https://assets.ppy.sh/beatmaps/${cache.map?.beatmapset_id}/covers/cover@2x.jpg')`);
        }
        else {
            const path = `http://${location.host}/Songs/${data.folders.beatmap}/${data.files.background}`.replace(/#/g, '%23').replace(/%/g, '%25').replace(/\\/g, '/');
            $('#map_background').css('background-image', `url('${path}')`);
        }

        if (cache.map?.teto) $('#teto').css('background-image', `url('../../_shared/assets/tetos/${cache.map?.teto}.gif')`);
        else $('#teto').css('background-image', 'none');
    }

    if (cache.setup_complete) {
        const players_in_lobby = data.tourney.clients.map(c => c.user);
        if (cache.players_in_lobby?.length === 0 || JSON.stringify(cache.players_in_lobby) !== JSON.stringify(players_in_lobby)) {
            cache.players_in_lobby = players_in_lobby;

            for (const client of data.tourney.clients) {
                const id = client.ipcId + 1;
                if (eliminated.includes(id)) continue;

                $(`#client${id}_name`).text(client.user.name);
            }

            const number_of_players = players_in_lobby.filter(e => e.name !== '').length;
            if (number_of_players !== cache.number_of_players) {
                cache.number_of_players = number_of_players;

                console.log('redoing leaderboard');
                // redo leaderboard
                $('#leaderboard').html('');
                leaderboard.clear();
                leaderboard_animation = {};
                for (const player of players_in_lobby.filter(e => e.name !== '')) {
                    const lb_item = new LeaderboardItem(player);
                    lb_item.generate();
                    $('#leaderboard').append(lb_item.parent);
                    leaderboard.set(player.id, lb_item);
                }
            }
        }

        if (cache.scoreVisible) {
            const lowest_score = Math.min(...data.tourney.clients.filter(e => e.user.name !== '').map(e => e.play.score / (e.play?.mods?.array.includes('HD') && !cache.map?.mods?.includes('HD') ? 1.06 : 1)));
            for (const client of data.tourney.clients) {
                const id = client.ipcId + 1;
                if (eliminated.includes(id)) continue;
                const client_obj = clients.get(id);

                const mods = client.play?.mods?.array ?? [];
                const map_hd = cache.map?.mods?.includes('HD') ?? false;
                const score = (client.play?.score ?? 0) / (mods.includes('HD') && !map_hd ? 1.06 : 1);

                client_obj.animation.score.update(score);
                client_obj.animation.acc.update(client.play?.accuracy ?? 0);
                client_obj.animation.combo.update(client.play?.combo?.current ?? 0);

                const lb_item = leaderboard.get(client.user.id);
                if (lb_item) { lb_item.score = score; lb_item.animation.update(score) };

                if (score === lowest_score && score > 0) client_obj.parent.addClass('danger');
                else client_obj.parent.removeClass('danger');
            }

            // update leaderboard every 300ms
            if (now - cache.last_leaderboard_update > 300) {
                const lb_display_amt = 6;
                cache.last_leaderboard_update = now;
                const lb_array = Array.from(leaderboard).map(e => e[1]).sort((a, b) => a.score - b.score);
                const top = lb_array.slice(0, lb_display_amt);
                console.log(top);

                let i = lb_array.length;
                for (const player of top) {
                    const entry = leaderboard_obj.querySelector(`[data-pid="${player.player.id}"]`);
                    if (entry) {
                        entry.style.display = 'flex';
                        entry.querySelector('.leaderboard-rank').textContent = i;
                        leaderboard_obj.appendChild(entry);
                    }
                    i--;
                }
                for (const player of lb_array.slice(lb_display_amt)) {
                    const entry = leaderboard_obj.querySelector(`[data-pid="${player.player.id}"]`);
                    console.log(entry);
                    if (entry) entry.style.display = 'none';
                }
            }
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
}

const toggleChat = () => {
    $('#chat').css('display', cache.chat_enabled ? 'none' : 'flex');
    $('#leaderboard').css('display', cache.chat_enabled ? 'flex' : 'none');
    $('#leaderboard_title').text(cache.chat_enabled ? 'Danger Zone' : 'CHAT');
    cache.chat_enabled = !cache.chat_enabled;
};
