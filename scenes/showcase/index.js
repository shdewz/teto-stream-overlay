const socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');

let mappool;
(async () => {
	$.ajaxSetup({ cache: false });
	const stage = await $.getJSON('../../_data/beatmaps.json');
	mappool = stage.beatmaps;
	if (mappool) $('#round_label').text(stage.stage).css('opacity', 1);
	else $('#stage_name').text('').css('opacity', 0);
})();

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

const cache = {
	update_stats: false,
	stats_updated: false,
	added_tetos: []
};

socket.onmessage = async event => {
	const data = JSON.parse(event.data);

	if (cache.state !== data.state.number) {
		cache.state = data.state.number;
		if (cache.state !== 2) $('#header').css('opacity', 0);
		else $('#header').css('opacity', 1);
	}

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

		const prev_map = cache.previous_beatmap;
		if (prev_map && prev_map?.beatmap_id !== data.beatmap.id) {
			if (!cache.added_tetos.includes(prev_map.teto)) {
				addTetoFish(prev_map.teto);
				cache.added_tetos.push(prev_map.teto);
			}
		}

		cache.previous_beatmap = map;
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

const addTetoFish = (teto) => {
	const teto_sway_container = $('<img>').attr('src', `../../_shared/assets/tetos/${teto}.gif`).addClass('teto-fish-sway-container');

	const teto_jump_container = $('<div></div>').addClass('teto-fish-jump-container');
	const teto_move_container = $('<div></div>').addClass('teto-fish-move-container');
	const animation_duration = 24 + Math.floor(Math.random() * 16);
	teto_move_container.css('animation-duration', `${animation_duration}s`);

	teto_move_container.append(teto_sway_container);
	teto_jump_container.append(teto_move_container)
	$('#teto_fishtank').append(teto_jump_container);

	setInterval(() => {
		if (Math.random() < 0.02) {
			teto_jump_container.addClass('teto-jump-activate');
			setTimeout(() => { teto_jump_container.removeClass('teto-jump-activate'); }, 1000);
		}
	}, 1000);
};
