# 90mil Radio Website

Website for 90mil Radio - an independent platform for experimental arts and sound in Berlin. Built with Jekyll and hosted on GitHub Pages at radio.90mil.berlin.

## Development

```bash
# Install dependencies
bundle install

# Run locally
bundle exec jekyll serve
```

## Structure
- `/assets` - CSS, JS, and images
- `/_sass` - SCSS components and styles
- `/_includes` - Reusable HTML components
- `/_layouts` - Page templates
- `/_data` - Site configuration

## Deployment
Site automatically deploys to GitHub Pages when changes are pushed to main branch.

See [LICENSE](LICENSE.md) for code and content terms.


## Local development
If you don't want to install ruby and jekyll globally, you can use Docker to run the site locally:
```
docker run --rm --volume="$PWD:/srv/jekyll" -p 4000:4000 -it jekyll/jekyll:latest bash -c "bundle install && bundle exec jekyll serve --host 0.0.0.0"
```
*the `--rm` flag ensures the container is removed after you stop it.*

Then open your browser at `http://localhost:4000`.
