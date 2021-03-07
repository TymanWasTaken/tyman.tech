$('document').ready(async () => {
	$('#searchBar').on('input', () => {
		const search = $('#searchBar').val()
		$('div#files>div')
			.toArray()
			.forEach((v) => {
				if (v.innerText.toLowerCase().includes(search.toLowerCase())) {
					$(v).removeClass('hidden')
				} else {
					$(v).addClass('hidden')
				}
			})
	})
	const filesReq = await fetch('api/modfiles')
	const files = await filesReq.json()
	if (files.success) {
		const modsStorted = {}
		for (const file of files.files) {
			if (!modsStorted[file.name]) modsStorted[file.name] = [file]
			else modsStorted[file.name].push(file)
		}
		for (const key in modsStorted) {
			if (Object.prototype.hasOwnProperty.call(modsStorted, key)) {
				modsStorted[key] = modsStorted[key].sort((a, b) =>
					semver.rcompare(a.version, b.version)
				)
			}
		}
		for (const file of Object.values(modsStorted)
			.sort()
			.reduce((a, b) => [...a, ...b])) {
			const div = $('<div></div>')
			div.addClass('filesDiv')
			div.addClass('tooltip')
			div.prop('title', file.description)
			const a = $('<a></a>')
			a.attr('href', file.url)
			a.append(
				`${file.name}-${file.version}.jar${
					file['needs-whitelist'] ? ' (NEEDS WHITELIST)' : ''
				}`
			)
			div.append(a)
			$('#files').append(div)
		}
	} else {
		alert('Error loading files')
	}
	$('#header').text('Mod Files')
})
