"""
El código de barras / QR deja de llevar el prefijo "YQ": ahora ES el DNI.
Resincroniza los alumnos ya existentes (corre por cada schema de colegio).
Seguro: los valores nuevos (DNI puro) nunca colisionan con los viejos
("YQ"+dni) y el DNI es único, así que la unicidad se mantiene.
"""
from django.db import migrations
from django.db.models import F


def codigo_a_dni(apps, schema_editor):
    Alumno = apps.get_model('colegios', 'Alumno')
    Alumno.objects.update(codigo_barras=F('dni'))


def noop(apps, schema_editor):
    # No se restaura el prefijo "YQ": el requisito quedó eliminado.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('colegios', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(codigo_a_dni, noop),
    ]
