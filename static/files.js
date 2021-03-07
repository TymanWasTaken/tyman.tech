function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

$('document').ready(async () => {
	$('#searchBar').on('input', async () => {
		const search = $('#searchBar').val();
		const fileElements = $('div#files>a').toArray();
		for (const e of fileElements) {
			const $e = $(e);
			if ($e.text().toLowerCase().includes(search.toLowerCase())) {
				$e.removeClass('hidden');
			} else {
				$e.addClass('hidden');
			}
			await sleep(15);
		}
	});
	const filesReq = await fetch('api/modfiles');
	const files = await filesReq.json();
	if (files.success) {
		const modsStorted = {};
		for (const file of files.files) {
			if (!modsStorted[file.name]) modsStorted[file.name] = [file];
			else modsStorted[file.name].push(file);
		}
		for (const key in modsStorted) {
			if (Object.prototype.hasOwnProperty.call(modsStorted, key)) {
				modsStorted[key] = modsStorted[key].sort((a, b) =>
					semver.rcompare(a.version, b.version)
				);
			}
		}
		for (const file of Object.values(modsStorted)
			.sort()
			.reduce((a, b) => [...a, ...b])) {
			const $div = $('<div></div>');
			$div.addClass('filesDiv');
			$div.addClass('tooltip');
			$div.prop('title', file.description);
			$div.append(
				`${file.name}-${file.version}.jar${
					file['needs-whitelist'] ? ' (NEEDS WHITELIST)' : ''
				}`
			);
			const $a = $('<a></a>');
			$a.attr('href', file.url);
			$a.append($div);
			$('#files').append($a);
		}
	} else {
		alert('Error loading files');
	}
	$('#header').text('Mod Files');
});
