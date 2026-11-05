<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NewsTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_news_page_lists_three_articles_newest_first(): void
    {
        $articles = config('news.articles');
        $this->assertCount(3, $articles);
        $dates = array_column($articles, 'date');
        $sorted = $dates;
        rsort($sorted);
        $this->assertSame($sorted, $dates);

        $res = $this->get('/news')->assertOk();
        foreach ($articles as $article) {
            $res->assertSee($article['title'])->assertSee('/news/'.$article['slug']);
        }
    }

    public function test_each_article_has_its_own_page_and_links_to_the_others(): void
    {
        foreach (config('news.articles') as $article) {
            $this->get('/news/'.$article['slug'])->assertOk()
                ->assertSee($article['title'])->assertSee($article['summary'])->assertSee('More news');
        }
        $this->get('/news/castles-you-can-climb')->assertSee('The undercroft')->assertSee('Giants below');
        $this->get('/news/no-such-article')->assertNotFound();
    }

    public function test_the_home_page_and_the_menu_point_to_the_news(): void
    {
        $this->get('/')->assertOk()->assertSee('Latest news')->assertSee('/news/castles-you-can-climb')->assertSee('>News<', false);
    }
}
