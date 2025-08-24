const delay = async time => new Promise(resolve => setTimeout(resolve, time));

const opposite_team = color => color === 'red' ? 'blue' : 'red';

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
		if (Math.random() < 0.08) {
			teto_jump_container.addClass('teto-jump-activate');
			setTimeout(() => { teto_jump_container.removeClass('teto-jump-activate'); }, 1000);
		}
	}, 1000);
};
