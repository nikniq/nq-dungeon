<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HeroPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_public_glossaries_are_served_to_everyone(): void
    {
        $this->get('/world/towns')->assertOk()->assertSee('Towns of the realms')->assertSee('js/script.js')->assertSee("mode: 'glossary'", false);
        $this->get('/world/characters')->assertOk()->assertSee('Characters of the realms')->assertSee('"characters"', false);
        $this->get('/')->assertOk()->assertSee('/world/towns');
        $this->get('/world/items')->assertOk()->assertSee('Items of the realms')->assertSee('Royal greatsword')->assertSee('Cleaving')->assertSee('Fangblade')->assertSee('Spider Queen')->assertSee('Seal of the Jade Throne')->assertSee('Golden carp')->assertSee('A treasure chart')->assertSee('The Spice Bazaar of spices towns')->assertSee('Whetstone');
        $this->get('/')->assertOk()->assertSee('/world/items');
    }
}
