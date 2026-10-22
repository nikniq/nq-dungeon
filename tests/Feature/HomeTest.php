<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HomeTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_page_links_back_to_nikniq(): void
    {
        $this->get('/')->assertOk()->assertSee('https://nikniq.com/')->assertSee('Back to nikniq.com');
        $this->get('/play')->assertOk()->assertSee('https://nikniq.com/');
    }
}
