from urllib.parse import urlsplit


def get_cors_origins(frontend_url: str) -> list[str]:
    frontend = urlsplit(frontend_url)
    if frontend.scheme not in {'http', 'https'} or not frontend.hostname:
        raise ValueError('FRONTEND_URL must be an absolute HTTP(S) URL.')

    origin = f'{frontend.scheme}://{frontend.netloc}'
    origins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        origin,
    ]

    if frontend.hostname == 'localhost':
        alias_host = '127.0.0.1'
    elif frontend.hostname == '127.0.0.1':
        alias_host = 'localhost'
    else:
        alias_host = ''

    if alias_host:
        port = f':{frontend.port}' if frontend.port else ''
        origins.append(f'{frontend.scheme}://{alias_host}{port}')

    return list(dict.fromkeys(origins))
